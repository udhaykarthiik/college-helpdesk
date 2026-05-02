from django.db import models
from django.contrib.auth.models import User
from django.core.validators import RegexValidator, MinValueValidator, MaxValueValidator

class College(models.Model):
    
    name = models.CharField(max_length=200)
    domain = models.CharField(max_length=100, help_text="Email domain (e.g., abc.edu)")
    address = models.TextField(blank=True)
    phone = models.CharField(max_length=20, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    
    def __str__(self):
        return self.name

class Department(models.Model):
    """Academic departments like CSE, ECE, MECH, BSc, MCA, MBA, MSc"""
    name = models.CharField(max_length=100)
    code = models.CharField(max_length=10, unique=True)
    college = models.ForeignKey(College, on_delete=models.CASCADE, related_name='departments')
    
    def __str__(self):
        return f"{self.name} ({self.code})"

class UserProfile(models.Model):
    """Extended user profile for students, staff, parents"""
    
    USER_TYPE_CHOICES = [
        ('student', 'Student'),
        ('staff', 'Staff/Teacher'),
        ('parent', 'Parent'),
        ('agent', 'Agent'),
        ('super_admin', 'Super Admin'),
    ]
    
    STUDENT_TYPE_CHOICES = [
        ('hosteller', 'Hosteller'),
        ('day_scholar', 'Day Scholar'),
        ('transport_user', 'Transport User'),
    ]
    
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='profile')
    college = models.ForeignKey(College, on_delete=models.CASCADE, related_name='users')
    user_type = models.CharField(max_length=20, choices=USER_TYPE_CHOICES, default='student')
    
    # For Students
    roll_number = models.CharField(max_length=20, blank=True, null=True, unique=True)
    student_type = models.CharField(max_length=20, choices=STUDENT_TYPE_CHOICES, blank=True, null=True)
    department = models.ForeignKey(Department, on_delete=models.SET_NULL, null=True, blank=True)
    year = models.IntegerField(blank=True, null=True, validators=[MinValueValidator(1), MaxValueValidator(5)])
    hostel_name = models.CharField(max_length=100, blank=True, null=True)
    bus_route = models.CharField(max_length=100, blank=True, null=True)
    parent = models.ForeignKey('self', on_delete=models.SET_NULL, null=True, blank=True, related_name='children')
    
    # For Staff
    employee_id = models.CharField(max_length=20, blank=True, null=True, unique=True)
    designation = models.CharField(max_length=100, blank=True, null=True)  # Professor, HOD, etc.
    
    # Verification status
    is_verified = models.BooleanField(default=False)
    verified_at = models.DateTimeField(blank=True, null=True)
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    def __str__(self):
        return f"{self.user.username} - {self.get_user_type_display()}"

class TicketCategory(models.Model):
    """Categories from the responsibility matrix"""
    CATEGORY_TYPE_CHOICES = [
        ('hostel', 'Hostel'),
        ('mess', 'Mess/Food'),
        ('academic', 'Academic'),
        ('equipment', 'Classroom Equipment'),
        ('attendance', 'Attendance System'),
        ('leave', 'Leave Application'),
        ('accounts', 'Fee/Accounts'),
        ('library', 'Library'),
        ('transport', 'Transport'),
        ('sports', 'Sports'),
        ('placement', 'Placement'),
        ('general', 'General'),
    ]
    
    name = models.CharField(max_length=50, choices=CATEGORY_TYPE_CHOICES, unique=True)
    display_name = models.CharField(max_length=100)
    description = models.TextField(blank=True)
    allowed_user_types = models.JSONField(default=list, help_text="Who can raise tickets in this category")
    
    def __str__(self):
        return self.display_name

class AgentDepartment(models.Model):
    """Links agents to specific departments/categories they can handle"""
    agent = models.ForeignKey('Agent', on_delete=models.CASCADE, related_name='assigned_categories')
    category = models.ForeignKey(TicketCategory, on_delete=models.CASCADE)
    is_primary = models.BooleanField(default=False)
    
    class Meta:
        unique_together = ['agent', 'category']
    
    def __str__(self):
        return f"{self.agent.user.username} -> {self.category.display_name}"

class Agent(models.Model):
    """College department staff who resolve tickets"""
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='agent_profile')
    college = models.ForeignKey(College, on_delete=models.CASCADE)
    categories = models.ManyToManyField(TicketCategory, through=AgentDepartment, related_name='agents')
    is_senior = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    
    def __str__(self):
        return f"{self.user.username} - Agent"

class Ticket(models.Model):
    """Customer support ticket - now as College Issue"""
    
    STATUS_CHOICES = [
        ('new', 'New'),
        ('open', 'Open'),
        ('pending', 'Pending'),
        ('resolved', 'Resolved'),
        ('closed', 'Closed'),
    ]
    
    PRIORITY_CHOICES = [
        ('low', 'Low'),
        ('medium', 'Medium'),
        ('high', 'High'),
        ('urgent', 'Urgent'),
    ]
    
    CHANNEL_CHOICES = [
        ('email', 'Email'),
        ('chat', 'Chat'),
        ('phone', 'Phone'),
        ('web', 'Web Form'),
    ]
    
    title = models.CharField(max_length=200)
    description = models.TextField()
    category = models.ForeignKey(TicketCategory, on_delete=models.CASCADE, related_name='tickets')
    raised_by = models.ForeignKey(UserProfile, on_delete=models.CASCADE, related_name='raised_tickets')
    assigned_to = models.ForeignKey(Agent, null=True, blank=True, on_delete=models.SET_NULL, related_name='assigned_tickets')
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='new')
    priority = models.CharField(max_length=20, choices=PRIORITY_CHOICES, default='medium')
    channel = models.CharField(max_length=20, choices=CHANNEL_CHOICES, default='web')
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    resolved_at = models.DateTimeField(null=True, blank=True)
    
    def __str__(self):
        return f"Issue #{self.id}: {self.title}"
    
    def get_variable_context(self):
        context = {
            'raised_by_name': self.raised_by.user.get_full_name() or self.raised_by.user.username,
            'raised_by_email': self.raised_by.user.email,
            'ticket_id': self.id,
            'ticket_title': self.title,
            'ticket_status': self.status,
            'ticket_priority': self.priority,
            'category': self.category.display_name,
        }
        
        # Add student-specific context if applicable
        if self.raised_by.user_type == 'student' and self.raised_by.student_type:
            context['student_type'] = self.raised_by.get_student_type_display()
            if self.raised_by.roll_number:
                context['roll_number'] = self.raised_by.roll_number
        
        return context

class Conversation(models.Model):
    """Messages between user and agent"""
    ticket = models.ForeignKey(Ticket, on_delete=models.CASCADE, related_name='conversations')
    sender_type = models.CharField(max_length=20, choices=[
        ('user', 'User'),
        ('agent', 'Agent'),
    ])
    sender_name = models.CharField(max_length=100, blank=True)
    message = models.TextField()
    is_internal_note = models.BooleanField(default=False)
    mentions = models.ManyToManyField(Agent, blank=True, related_name='mentioned_in')
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        ordering = ['created_at']
    
    def __str__(self):
        return f"Message on Issue #{self.ticket.id} at {self.created_at}"

# Keep the rest of your existing models (CannedCategory, CannedResponse, etc.)
# but update their organization references to college

class CannedCategory(models.Model):
    name = models.CharField(max_length=100)
    college = models.ForeignKey(College, on_delete=models.CASCADE, related_name='canned_categories')
    description = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        ordering = ['name']
        unique_together = ['name', 'college']
    
    def __str__(self):
        return self.name

class CannedResponse(models.Model):
    category = models.ForeignKey(CannedCategory, on_delete=models.SET_NULL, null=True, blank=True, related_name='canned_responses')
    title = models.CharField(max_length=100)
    shortcode = models.CharField(max_length=50)
    content = models.TextField()
    variables = models.JSONField(default=list, blank=True)
    department = models.CharField(max_length=50, blank=True)
    college = models.ForeignKey(College, on_delete=models.CASCADE, related_name='canned_responses')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    usage_count = models.IntegerField(default=0)
    
    class Meta:
        ordering = ['category__name', 'title']
        unique_together = ['shortcode', 'college']
    
    def __str__(self):
        return f"{self.shortcode} - {self.title}"
    
    def extract_variables(self):
        import re
        pattern = r'\{\{([^}]+)\}\}'
        variables = re.findall(pattern, self.content)
        variables = list(set([v.strip() for v in variables]))
        self.variables = variables
        self.save(update_fields=['variables'])
        return variables
    
    def render(self, context):
        rendered = self.content
        for var in self.variables:
            value = context.get(var, f'[{var} not found]')
            rendered = rendered.replace(f'{{{{{var}}}}}', str(value))
        return rendered

# Keep RoutingRule, KnowledgeCategory, KnowledgeArticle, ArticleFeedback, TicketAttachment as they are
# (just update Organization references to College if needed)

class RoutingRule(models.Model):
    college = models.ForeignKey(College, on_delete=models.CASCADE, related_name='routing_rules')
    name = models.CharField(max_length=100)
    keywords = models.TextField()
    condition = models.CharField(max_length=20, choices=[('contains', 'Contains'), ('equals', 'Equals')], default='contains')
    category = models.ForeignKey(TicketCategory, on_delete=models.CASCADE)
    priority = models.CharField(max_length=20, choices=Ticket.PRIORITY_CHOICES, default='medium')
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    
    def __str__(self):
        return f"{self.name} -> {self.category.display_name}"
    
    def get_keywords_list(self):
        return [k.strip().lower() for k in self.keywords.split(',')]

# Keep KnowledgeBase models (update organization to college)
class KnowledgeCategory(models.Model):
    name = models.CharField(max_length=100)
    description = models.TextField(blank=True)
    college = models.ForeignKey(College, on_delete=models.CASCADE, related_name='kb_categories')
    icon = models.CharField(max_length=50, blank=True)
    display_order = models.IntegerField(default=0)
    is_public = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        ordering = ['display_order', 'name']
        verbose_name_plural = "Knowledge categories"
    
    def __str__(self):
        return self.name

class KnowledgeArticle(models.Model):
    category = models.ForeignKey(KnowledgeCategory, on_delete=models.CASCADE, related_name='articles')
    title = models.CharField(max_length=200)
    content = models.TextField()
    summary = models.TextField(max_length=500, blank=True)
    college = models.ForeignKey(College, on_delete=models.CASCADE, related_name='kb_articles')
    author = models.ForeignKey(Agent, null=True, blank=True, on_delete=models.SET_NULL)
    tags = models.CharField(max_length=500, blank=True)
    is_published = models.BooleanField(default=True)
    is_public = models.BooleanField(default=True)
    is_featured = models.BooleanField(default=False)
    views = models.IntegerField(default=0)
    helpful_count = models.IntegerField(default=0)
    not_helpful_count = models.IntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    published_at = models.DateTimeField(null=True, blank=True)
    
    class Meta:
        ordering = ['-is_featured', '-views', '-created_at']
        indexes = [
            models.Index(fields=['college', 'is_published']),
            models.Index(fields=['college', 'category']),
        ]
    
    def __str__(self):
        return self.title
    
    def get_tags_list(self):
        if self.tags:
            return [tag.strip() for tag in self.tags.split(',') if tag.strip()]
        return []
    
    def helpful_percentage(self):
        total = self.helpful_count + self.not_helpful_count
        if total == 0:
            return 0
        return round((self.helpful_count / total) * 100)
    
    def increment_views(self):
        self.views += 1
        self.save(update_fields=['views'])

class ArticleFeedback(models.Model):
    article = models.ForeignKey(KnowledgeArticle, on_delete=models.CASCADE, related_name='feedback')
    user = models.ForeignKey(UserProfile, null=True, blank=True, on_delete=models.SET_NULL)
    session_id = models.CharField(max_length=100, blank=True)
    is_helpful = models.BooleanField()
    comment = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    
    def __str__(self):
        return f"Feedback on {self.article.title}: {'👍' if self.is_helpful else '👎'}"

class TicketAttachment(models.Model):
    ticket = models.ForeignKey(Ticket, on_delete=models.CASCADE, related_name='attachments')
    file = models.FileField(upload_to='ticket_attachments/%Y/%m/%d/')
    filename = models.CharField(max_length=255, blank=True)
    file_size = models.IntegerField(blank=True, null=True)
    uploaded_by = models.CharField(max_length=50, choices=[
        ('user', 'User'),
        ('agent', 'Agent'),
    ])
    created_at = models.DateTimeField(auto_now_add=True)
    
    def save(self, *args, **kwargs):
        if self.file and not self.filename:
            self.filename = self.file.name
        if self.file and not self.file_size:
            self.file_size = self.file.size
        super().save(*args, **kwargs)
    
    def __str__(self):
        return f"{self.filename} for Issue #{self.ticket.id}"