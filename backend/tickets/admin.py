from django.contrib import admin
from django.utils import timezone
from .models import (
    College, Department, UserProfile, TicketCategory, Agent, AgentDepartment,
    Ticket, Conversation, CannedCategory, CannedResponse, RoutingRule,
    KnowledgeCategory, KnowledgeArticle, ArticleFeedback, TicketAttachment
)

@admin.register(College)
class CollegeAdmin(admin.ModelAdmin):
    list_display = ('id', 'name', 'domain', 'phone', 'created_at')
    search_fields = ('name', 'domain')

@admin.register(Department)
class DepartmentAdmin(admin.ModelAdmin):
    list_display = ('id', 'name', 'code', 'college')
    list_filter = ('college',)
    search_fields = ('name', 'code')

@admin.register(UserProfile)
class UserProfileAdmin(admin.ModelAdmin):
    list_display = ('id', 'user', 'user_type', 'roll_number', 'employee_id', 'college', 'is_verified')
    list_filter = ('user_type', 'student_type', 'college', 'is_verified')
    search_fields = ('user__username', 'user__email', 'roll_number', 'employee_id')
    list_editable = ('is_verified',)
    
    fieldsets = (
        ('Basic Information', {
            'fields': ('user', 'college', 'user_type')
        }),
        ('Student Information', {
            'fields': ('roll_number', 'student_type', 'department', 'year', 'hostel_name', 'bus_route'),
            'classes': ('collapse',)
        }),
        ('Staff Information', {
            'fields': ('employee_id', 'designation'),
            'classes': ('collapse',)
        }),
        ('Parent Information', {
            'fields': ('parent',),
            'classes': ('collapse',)
        }),
        ('Verification', {
            'fields': ('is_verified', 'verified_at'),
            'classes': ('collapse',)
        }),
    )

@admin.register(TicketCategory)
class TicketCategoryAdmin(admin.ModelAdmin):
    list_display = ('id', 'display_name', 'name')
    search_fields = ('display_name', 'name')

@admin.register(Agent)
class AgentAdmin(admin.ModelAdmin):
    list_display = ('id', 'user', 'college', 'is_senior', 'created_at')
    list_filter = ('college', 'is_senior')
    search_fields = ('user__username', 'user__email')
    

@admin.register(AgentDepartment)
class AgentDepartmentAdmin(admin.ModelAdmin):
    list_display = ('id', 'agent', 'category', 'is_primary')
    list_filter = ('is_primary', 'category')

@admin.register(Ticket)
class TicketAdmin(admin.ModelAdmin):
    list_display = ('id', 'title', 'raised_by', 'category', 'assigned_to', 'status', 'priority', 'created_at')
    list_filter = ('status', 'priority', 'category', 'channel', 'created_at')
    search_fields = ('title', 'description', 'raised_by__user__email')
    list_editable = ('status', 'priority', 'assigned_to')
    date_hierarchy = 'created_at'
    
    fieldsets = (
        ('Basic Information', {
            'fields': ('title', 'description', 'category', 'raised_by')
        }),
        ('Assignment & Status', {
            'fields': ('assigned_to', 'status', 'priority', 'channel')
        }),
        ('Timestamps', {
            'fields': ('resolved_at',),
            'classes': ('collapse',)
        }),
    )

@admin.register(Conversation)
class ConversationAdmin(admin.ModelAdmin):
    list_display = ('id', 'ticket', 'sender_type', 'is_internal_note', 'created_at')
    list_filter = ('sender_type', 'is_internal_note', 'created_at')
    search_fields = ('message', 'ticket__title')
    
    def get_queryset(self, request):
        return super().get_queryset(request).select_related('ticket')

@admin.register(CannedCategory)
class CannedCategoryAdmin(admin.ModelAdmin):
    list_display = ('id', 'name', 'college', 'description', 'created_at')
    list_filter = ('college',)
    search_fields = ('name', 'description')
    list_editable = ('name',)

@admin.register(CannedResponse)
class CannedResponseAdmin(admin.ModelAdmin):
    list_display = ('id', 'title', 'shortcode', 'category', 'department', 'college', 'usage_count', 'created_at')
    list_filter = ('category', 'department', 'college')
    search_fields = ('title', 'shortcode', 'content')
    list_editable = ('shortcode', 'category', 'department')
    readonly_fields = ('variables', 'usage_count')
    
    fieldsets = (
        ('Basic Information', {
            'fields': ('title', 'shortcode', 'category', 'department', 'college')
        }),
        ('Content', {
            'fields': ('content',),
        }),
        ('Auto-generated', {
            'fields': ('variables', 'usage_count'),
            'classes': ('collapse',)
        }),
    )

@admin.register(RoutingRule)
class RoutingRuleAdmin(admin.ModelAdmin):
    list_display = ('id', 'name', 'category', 'priority', 'is_active', 'college')
    list_filter = ('category', 'priority', 'is_active', 'college')
    search_fields = ('name', 'keywords')
    list_editable = ('is_active', 'priority')

@admin.register(KnowledgeCategory)
class KnowledgeCategoryAdmin(admin.ModelAdmin):
    list_display = ('id', 'name', 'college', 'article_count', 'is_public', 'display_order')
    list_filter = ('college', 'is_public')
    search_fields = ('name', 'description')
    list_editable = ('display_order', 'is_public')
    
    def article_count(self, obj):
        return obj.articles.count()
    article_count.short_description = 'Articles'

@admin.register(KnowledgeArticle)
class KnowledgeArticleAdmin(admin.ModelAdmin):
    list_display = ('id', 'title', 'category', 'is_published', 'is_public', 'is_featured', 'views', 'helpful_percentage_display', 'created_at')
    list_filter = ('category', 'is_published', 'is_public', 'is_featured', 'college')
    search_fields = ('title', 'content', 'summary', 'tags')
    list_editable = ('is_published', 'is_public', 'is_featured')
    readonly_fields = ('views', 'helpful_count', 'not_helpful_count', 'helpful_percentage_display', 'created_at', 'updated_at')
    date_hierarchy = 'created_at'
    
    fieldsets = (
        ('Basic Information', {
            'fields': ('title', 'summary', 'content', 'category', 'college')
        }),
        ('Metadata', {
            'fields': ('author', 'tags', 'is_published', 'is_public', 'is_featured')
        }),
        ('Statistics', {
            'fields': ('views', 'helpful_count', 'not_helpful_count', 'helpful_percentage_display'),
            'classes': ('collapse',)
        }),
        ('Timestamps', {
            'fields': ('published_at',),
            'classes': ('collapse',)
        }),
    )
    
    def helpful_percentage_display(self, obj):
        percentage = obj.helpful_percentage()
        return f"{percentage}% ({obj.helpful_count}👍 / {obj.not_helpful_count}👎)"
    helpful_percentage_display.short_description = 'Helpful %'
    
    def save_model(self, request, obj, form, change):
        if not obj.author_id:
            try:
                from .models import Agent
                obj.author = Agent.objects.get(user=request.user)
            except Agent.DoesNotExist:
                pass
        if obj.is_published and not obj.published_at:
            obj.published_at = timezone.now()
        super().save_model(request, obj, form, change)

@admin.register(ArticleFeedback)
class ArticleFeedbackAdmin(admin.ModelAdmin):
    list_display = ('id', 'article', 'is_helpful', 'user', 'session_id', 'created_at')
    list_filter = ('is_helpful', 'created_at')
    search_fields = ('article__title', 'comment', 'user__user__email')
    readonly_fields = ('created_at',)

@admin.register(TicketAttachment)
class TicketAttachmentAdmin(admin.ModelAdmin):
    list_display = ('id', 'ticket', 'filename', 'file_size', 'uploaded_by', 'created_at')
    list_filter = ('uploaded_by', 'created_at')
    search_fields = ('filename', 'ticket__title')
    readonly_fields = ('filename', 'file_size', 'created_at')