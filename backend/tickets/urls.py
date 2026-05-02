from django.urls import path, include
from rest_framework.routers import DefaultRouter
from . import views

router = DefaultRouter()
router.register(r'colleges', views.CollegeViewSet)
router.register(r'departments', views.DepartmentViewSet)
router.register(r'user-profiles', views.UserProfileViewSet)
router.register(r'ticket-categories', views.TicketCategoryViewSet)
router.register(r'agents', views.AgentViewSet)
router.register(r'agent-departments', views.AgentDepartmentViewSet)
router.register(r'tickets', views.TicketViewSet)
router.register(r'conversations', views.ConversationViewSet)
router.register(r'attachments', views.TicketAttachmentViewSet)
router.register(r'canned-categories', views.CannedCategoryViewSet)
router.register(r'canned-responses', views.CannedResponseViewSet)
router.register(r'routing-rules', views.RoutingRuleViewSet)
router.register(r'knowledge-categories', views.KnowledgeCategoryViewSet)
router.register(r'knowledge-articles', views.KnowledgeArticleViewSet)
router.register(r'article-feedback', views.ArticleFeedbackViewSet)
# Super Admin stats endpoint (using ViewSet, needs basename)
router.register(r'admin-stats', views.AdminStatsViewSet, basename='admin-stats')

urlpatterns = [
    path('', include(router.urls)),
]