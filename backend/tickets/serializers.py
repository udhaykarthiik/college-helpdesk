from rest_framework import serializers
from django.contrib.auth.models import User
from .models import (
    College, Department, UserProfile, TicketCategory, Agent, AgentDepartment,
    Ticket, Conversation, CannedCategory, CannedResponse, RoutingRule,
    TicketAttachment, KnowledgeCategory, KnowledgeArticle, ArticleFeedback
)

# ========== COLLEGE & DEPARTMENT SERIALIZERS ==========

class CollegeSerializer(serializers.ModelSerializer):
    class Meta:
        model = College
        fields = '__all__'

class DepartmentSerializer(serializers.ModelSerializer):
    class Meta:
        model = Department
        fields = '__all__'

# ========== USER PROFILE SERIALIZERS ==========

class UserProfileSerializer(serializers.ModelSerializer):
    username = serializers.CharField(source='user.username', read_only=True)
    email = serializers.CharField(source='user.email', read_only=True)
    first_name = serializers.CharField(source='user.first_name', read_only=True)
    last_name = serializers.CharField(source='user.last_name', read_only=True)
    
    class Meta:
        model = UserProfile
        fields = [
            'id', 'username', 'email', 'first_name', 'last_name',
            'user_type', 'college', 'roll_number', 'employee_id',
            'student_type', 'department', 'year', 'hostel_name',
            'bus_route', 'designation', 'is_verified', 'created_at'
        ]

# ========== TICKET CATEGORY SERIALIZERS ==========

class TicketCategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = TicketCategory
        fields = '__all__'

# ========== AGENT SERIALIZERS ==========

class AgentSerializer(serializers.ModelSerializer):
    username = serializers.CharField(source='user.username', read_only=True)
    email = serializers.CharField(source='user.email', read_only=True)
    categories_list = serializers.SerializerMethodField()
    
    class Meta:
        model = Agent
        fields = ['id', 'username', 'email', 'college', 'is_senior', 'categories_list', 'created_at']
    
    def get_categories_list(self, obj):
        return [cat.category.display_name for cat in obj.assigned_categories.all()]

class AgentDepartmentSerializer(serializers.ModelSerializer):
    agent_name = serializers.CharField(source='agent.user.username', read_only=True)
    category_name = serializers.CharField(source='category.display_name', read_only=True)
    
    class Meta:
        model = AgentDepartment
        fields = ['id', 'agent', 'agent_name', 'category', 'category_name', 'is_primary']

# ========== ATTACHMENT SERIALIZERS ==========

class TicketAttachmentSerializer(serializers.ModelSerializer):
    file_url = serializers.SerializerMethodField()
    file_size_display = serializers.SerializerMethodField()
    
    class Meta:
        model = TicketAttachment
        fields = ['id', 'ticket', 'filename', 'file_url', 'file_size', 'file_size_display', 'uploaded_by', 'created_at']
        read_only_fields = ['filename', 'file_size']
    
    def get_file_url(self, obj):
        request = self.context.get('request')
        if request and obj.file:
            return request.build_absolute_uri(obj.file.url)
        return None
    
    def get_file_size_display(self, obj):
        size = obj.file_size
        if size < 1024:
            return f"{size} B"
        elif size < 1024 * 1024:
            return f"{size/1024:.1f} KB"
        else:
            return f"{size/(1024*1024):.1f} MB"

# ========== CONVERSATION SERIALIZERS ==========

class ConversationSerializer(serializers.ModelSerializer):
    sender_name = serializers.SerializerMethodField()
    
    class Meta:
        model = Conversation
        fields = ['id', 'ticket', 'sender_type', 'sender_name', 'message', 'is_internal_note', 'created_at']
    
    def get_sender_name(self, obj):
        if obj.sender_name:
            return obj.sender_name
        if obj.sender_type == 'user':
            return obj.ticket.raised_by.user.get_full_name() or obj.ticket.raised_by.user.username
        else:
            return obj.ticket.assigned_to.user.username if obj.ticket.assigned_to else 'Support Agent'

# ========== TICKET SERIALIZERS ==========

class TicketSerializer(serializers.ModelSerializer):
    raised_by_name = serializers.SerializerMethodField()
    raised_by_email = serializers.SerializerMethodField()
    category_name = serializers.CharField(source='category.display_name', read_only=True)
    assigned_to_name = serializers.SerializerMethodField()
    attachments = TicketAttachmentSerializer(many=True, read_only=True)
    
    class Meta:
        model = Ticket
        fields = [
            'id', 'title', 'description', 'category', 'category_name',
            'raised_by', 'raised_by_name', 'raised_by_email',
            'assigned_to', 'assigned_to_name', 'status', 'priority', 'channel',
            'created_at', 'updated_at', 'resolved_at', 'attachments'
        ]
    
    def get_raised_by_name(self, obj):
        if obj.raised_by and obj.raised_by.user:
            return obj.raised_by.user.get_full_name() or obj.raised_by.user.username
        return 'Guest User'
    
    def get_raised_by_email(self, obj):
        if obj.raised_by and obj.raised_by.user:
            return obj.raised_by.user.email
        return 'guest@example.com'
    
    def get_assigned_to_name(self, obj):
        if obj.assigned_to:
            return obj.assigned_to.user.username
        return None
    
    def get_conversations(self, obj):
        """Return conversations based on user role - Internal notes hidden from customers"""
        request = self.context.get('request')
        
        # Default: only show non-internal notes (for customers and public users)
        conversations = obj.conversations.filter(is_internal_note=False)
        
        # Check if user is authenticated and has access to internal notes
        if request and hasattr(request, 'user') and request.user.is_authenticated:
            # Super admin sees everything (including internal notes)
            if request.user.is_superuser:
                conversations = obj.conversations.all()
            # Agent sees everything (including internal notes)
            elif hasattr(request.user, 'agent'):
                conversations = obj.conversations.all()
            # Regular users (students/staff/parents) already filtered (only non-internal notes)
        
        return ConversationSerializer(conversations, many=True, context=self.context).data

class PublicTicketSerializer(serializers.ModelSerializer):
    email = serializers.EmailField(write_only=True)
    name = serializers.CharField(write_only=True)
    roll_number = serializers.CharField(write_only=True, required=False)
    category_id = serializers.IntegerField(write_only=True, required=False)
    
    class Meta:
        model = Ticket
        fields = ['title', 'description', 'category', 'email', 'name', 'roll_number', 'category_id', 'channel']
        extra_kwargs = {
            'channel': {'read_only': True},
            'category': {'read_only': True}
        }
    
    def create(self, validated_data):
        email = validated_data.pop('email')
        name = validated_data.pop('name')
        roll_number = validated_data.pop('roll_number', None)
        category_id = validated_data.pop('category_id', None)
        
        # Get or create college
        college, _ = College.objects.get_or_create(
            name="ABC College of Engineering",
            defaults={'domain': 'abc.edu'}
        )
        
        # Get or create user
        user, created = User.objects.get_or_create(
            email=email,
            defaults={'username': email.split('@')[0], 'first_name': name}
        )
        
        # Get or create user profile
        profile, _ = UserProfile.objects.get_or_create(
            user=user,
            defaults={
                'college': college,
                'user_type': 'student',
                'roll_number': roll_number
            }
        )
        
        # Get category
        if category_id:
            category = TicketCategory.objects.get(id=category_id)
        else:
            category = TicketCategory.objects.first()
        
        ticket = Ticket.objects.create(
            raised_by=profile,
            category=category,
            channel='web',
            **validated_data
        )
        
        return ticket

# ========== CANNED RESPONSE SERIALIZERS ==========

class CannedCategorySerializer(serializers.ModelSerializer):
    response_count = serializers.SerializerMethodField()
    
    class Meta:
        model = CannedCategory
        fields = ['id', 'name', 'college', 'description', 'response_count', 'created_at']
    
    def get_response_count(self, obj):
        return obj.canned_responses.count()

class CannedResponseSerializer(serializers.ModelSerializer):
    category_name = serializers.CharField(source='category.name', read_only=True)
    preview = serializers.SerializerMethodField()
    
    class Meta:
        model = CannedResponse
        fields = [
            'id', 'title', 'shortcode', 'content', 'variables', 'category', 'category_name',
            'department', 'college', 'usage_count', 'created_at', 'updated_at', 'preview'
        ]
        read_only_fields = ['variables', 'usage_count']
    
    def get_preview(self, obj):
        return obj.preview()

class CannedResponseRenderSerializer(serializers.Serializer):
    ticket_id = serializers.IntegerField(required=True)
    canned_response_id = serializers.IntegerField(required=True)
    
    def validate(self, data):
        try:
            ticket = Ticket.objects.get(id=data['ticket_id'])
            canned = CannedResponse.objects.get(id=data['canned_response_id'])
            data['ticket'] = ticket
            data['canned'] = canned
        except Ticket.DoesNotExist:
            raise serializers.ValidationError({"ticket_id": "Ticket not found"})
        except CannedResponse.DoesNotExist:
            raise serializers.ValidationError({"canned_response_id": "Canned response not found"})
        return data
    
    def get_rendered_content(self):
        ticket = self.validated_data['ticket']
        canned = self.validated_data['canned']
        
        canned.usage_count += 1
        canned.save(update_fields=['usage_count'])
        
        context = ticket.get_variable_context()
        rendered = canned.render(context)
        
        return {
            'rendered_content': rendered,
            'variables_used': canned.variables,
            'ticket_id': ticket.id,
            'canned_title': canned.title,
            'usage_count': canned.usage_count
        }

# ========== ROUTING RULE SERIALIZERS ==========

class RoutingRuleSerializer(serializers.ModelSerializer):
    category_name = serializers.CharField(source='category.display_name', read_only=True)
    
    class Meta:
        model = RoutingRule
        fields = ['id', 'name', 'keywords', 'condition', 'category', 'category_name', 
                  'priority', 'is_active', 'college', 'created_at']

# ========== KNOWLEDGE BASE SERIALIZERS ==========

class KnowledgeCategorySerializer(serializers.ModelSerializer):
    article_count = serializers.SerializerMethodField()
    
    class Meta:
        model = KnowledgeCategory
        fields = ['id', 'name', 'description', 'college', 'icon', 'display_order', 
                  'is_public', 'article_count', 'created_at']
    
    def get_article_count(self, obj):
        return obj.articles.filter(is_published=True).count()

class KnowledgeArticleSerializer(serializers.ModelSerializer):
    category_name = serializers.CharField(source='category.name', read_only=True)
    author_name = serializers.SerializerMethodField()
    tags_list = serializers.SerializerMethodField()
    helpful_percentage = serializers.SerializerMethodField()
    
    class Meta:
        model = KnowledgeArticle
        fields = [
            'id', 'title', 'summary', 'content', 'category', 'category_name',
            'college', 'author', 'author_name', 'tags', 'tags_list',
            'is_published', 'is_public', 'is_featured',
            'views', 'helpful_count', 'not_helpful_count', 'helpful_percentage',
            'created_at', 'updated_at', 'published_at'
        ]
        read_only_fields = ['views', 'helpful_count', 'not_helpful_count']
    
    def get_author_name(self, obj):
        if obj.author:
            return obj.author.user.username
        return None
    
    def get_tags_list(self, obj):
        return obj.get_tags_list()
    
    def get_helpful_percentage(self, obj):
        return obj.helpful_percentage()

class PublicKnowledgeArticleSerializer(serializers.ModelSerializer):
    category_name = serializers.CharField(source='category.name', read_only=True)
    tags_list = serializers.SerializerMethodField()
    
    class Meta:
        model = KnowledgeArticle
        fields = [
            'id', 'title', 'summary', 'content', 'category_name', 'tags_list',
            'views', 'helpful_percentage', 'created_at', 'updated_at'
        ]
        read_only_fields = ['views', 'helpful_percentage']
    
    def get_tags_list(self, obj):
        return obj.get_tags_list()

class ArticleFeedbackSerializer(serializers.ModelSerializer):
    class Meta:
        model = ArticleFeedback
        fields = ['id', 'article', 'user', 'session_id', 'is_helpful', 'comment', 'created_at']
        read_only_fields = ['created_at']
        