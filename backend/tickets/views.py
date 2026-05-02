from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from django.db.models import Q, Count
from django.utils import timezone
from django.conf import settings
from django.contrib.auth.models import User
import os
import re

from .models import (
    College, Department, UserProfile, TicketCategory, Agent, AgentDepartment,
    Ticket, Conversation, CannedCategory, CannedResponse, RoutingRule,
    TicketAttachment, KnowledgeCategory, KnowledgeArticle, ArticleFeedback
)

from .serializers import (
    CollegeSerializer, DepartmentSerializer, UserProfileSerializer, TicketCategorySerializer,
    AgentSerializer, AgentDepartmentSerializer,
    TicketSerializer, ConversationSerializer, CannedCategorySerializer,
    CannedResponseSerializer, CannedResponseRenderSerializer, RoutingRuleSerializer,
    TicketAttachmentSerializer, PublicTicketSerializer,
    KnowledgeCategorySerializer, KnowledgeArticleSerializer, 
    PublicKnowledgeArticleSerializer, ArticleFeedbackSerializer
)

from .ai_services import classify_ticket, generate_canned_response, check_ai_health
from .email_utils import send_ticket_confirmation, send_reply_notification


class CollegeViewSet(viewsets.ModelViewSet):
    queryset = College.objects.all()
    serializer_class = CollegeSerializer


class DepartmentViewSet(viewsets.ModelViewSet):
    queryset = Department.objects.all()
    serializer_class = DepartmentSerializer
    
    def get_queryset(self):
        queryset = Department.objects.all()
        college_id = self.request.query_params.get('college', None)
        if college_id:
            queryset = queryset.filter(college_id=college_id)
        return queryset


class UserProfileViewSet(viewsets.ModelViewSet):
    queryset = UserProfile.objects.all()
    serializer_class = UserProfileSerializer
    
    def get_queryset(self):
        queryset = UserProfile.objects.all()
        user_type = self.request.query_params.get('user_type', None)
        if user_type:
            queryset = queryset.filter(user_type=user_type)
        college_id = self.request.query_params.get('college', None)
        if college_id:
            queryset = queryset.filter(college_id=college_id)
        return queryset
    
    @action(detail=True, methods=['get'])
    def tickets(self, request, pk=None):
        profile = self.get_object()
        tickets = Ticket.objects.filter(raised_by=profile).order_by('-created_at')
        serializer = TicketSerializer(tickets, many=True, context={'request': request})
        return Response(serializer.data)


class TicketCategoryViewSet(viewsets.ModelViewSet):
    queryset = TicketCategory.objects.all()
    serializer_class = TicketCategorySerializer


class AgentViewSet(viewsets.ModelViewSet):
    queryset = Agent.objects.all()
    serializer_class = AgentSerializer
    
    def get_queryset(self):
        queryset = Agent.objects.all()
        college_id = self.request.query_params.get('college', None)
        if college_id:
            queryset = queryset.filter(college_id=college_id)
        category_id = self.request.query_params.get('category', None)
        if category_id:
            queryset = queryset.filter(categories=category_id)
        return queryset
    
    @action(detail=True, methods=['get'])
    def tickets(self, request, pk=None):
        agent = self.get_object()
        tickets = Ticket.objects.filter(assigned_to=agent).order_by('-created_at')
        serializer = TicketSerializer(tickets, many=True, context={'request': request})
        return Response(serializer.data)
    
    @action(detail=True, methods=['get'])
    def available_categories(self, request, pk=None):
        agent = self.get_object()
        categories = agent.categories.all()
        serializer = TicketCategorySerializer(categories, many=True)
        return Response(serializer.data)


class AgentDepartmentViewSet(viewsets.ModelViewSet):
    queryset = AgentDepartment.objects.all()
    serializer_class = AgentDepartmentSerializer


class AdminStatsViewSet(viewsets.ViewSet):
    
    def list(self, request):
        if not request.user.is_superuser:
            return Response({"error": "Unauthorized"}, status=403)
        
        students = UserProfile.objects.filter(user_type='student').count()
        staff = UserProfile.objects.filter(user_type='staff').count()
        parents = UserProfile.objects.filter(user_type='parent').count()
        agents = Agent.objects.count()
        
        total_tickets = Ticket.objects.count()
        open_tickets = Ticket.objects.filter(status__in=['new', 'open']).count()
        resolved_tickets = Ticket.objects.filter(status='resolved').count()
        
        recent_tickets = Ticket.objects.all().order_by('-created_at')[:10]
        recent_data = TicketSerializer(recent_tickets, many=True, context={'request': request}).data
        
        all_users = []
        for profile in UserProfile.objects.all().select_related('user', 'department'):
            all_users.append({
                'id': profile.id,
                'user_id': profile.user.id,
                'username': profile.user.username,
                'email': profile.user.email,
                'first_name': profile.user.first_name,
                'last_name': profile.user.last_name,
                'role': profile.user_type,
                'roll_number': profile.roll_number,
                'employee_id': profile.employee_id,
                'department': profile.department.name if profile.department else None,
                'is_active': profile.user.is_active,
                'created_at': profile.created_at
            })
        
        return Response({
            'stats': {
                'students': students,
                'staff': staff,
                'parents': parents,
                'agents': agents,
                'total_tickets': total_tickets,
                'open_tickets': open_tickets,
                'resolved_tickets': resolved_tickets,
            },
            'recent_tickets': recent_data,
            'users': all_users
        })
    
    @action(detail=True, methods=['patch'])
    def update_role(self, request, pk=None):
        if not request.user.is_superuser:
            return Response({"error": "Unauthorized"}, status=403)
        
        try:
            profile = UserProfile.objects.get(id=pk)
            new_role = request.data.get('role')
            
            if new_role not in ['student', 'staff', 'parent', 'agent']:
                return Response({"error": "Invalid role"}, status=400)
            
            profile.user_type = new_role
            profile.save()
            
            if new_role == 'agent':
                Agent.objects.get_or_create(
                    user=profile.user,
                    defaults={'college': profile.college}
                )
            
            return Response({"success": True, "new_role": new_role})
            
        except UserProfile.DoesNotExist:
            return Response({"error": "User not found"}, status=404)
    
    @action(detail=True, methods=['delete'])
    def delete_user(self, request, pk=None):
        if not request.user.is_superuser:
            return Response({"error": "Unauthorized"}, status=403)
        
        try:
            profile = UserProfile.objects.get(id=pk)
            user = profile.user
            user.delete()
            return Response({"success": True, "message": "User deleted successfully"})
            
        except UserProfile.DoesNotExist:
            return Response({"error": "User not found"}, status=404)


class TicketViewSet(viewsets.ModelViewSet):
    queryset = Ticket.objects.all().order_by('-created_at')
    serializer_class = TicketSerializer
    
    def get_queryset(self):
        queryset = Ticket.objects.all().order_by('-created_at')
        
        status = self.request.query_params.get('status', None)
        if status:
            queryset = queryset.filter(status=status)
        
        priority = self.request.query_params.get('priority', None)
        if priority:
            queryset = queryset.filter(priority=priority)
        
        assigned = self.request.query_params.get('assigned', None)
        if assigned:
            if assigned == 'unassigned':
                queryset = queryset.filter(assigned_to__isnull=True)
            else:
                queryset = queryset.filter(assigned_to=assigned)
        
        category = self.request.query_params.get('category', None)
        if category:
            queryset = queryset.filter(category_id=category)
        
        raised_by = self.request.query_params.get('raised_by', None)
        if raised_by:
            queryset = queryset.filter(raised_by_id=raised_by)
        
        user_type = self.request.query_params.get('user_type', None)
        if user_type:
            queryset = queryset.filter(raised_by__user_type=user_type)
        
        return queryset
    
    def get_serializer_context(self):
        context = super().get_serializer_context()
        context['request'] = self.request
        return context
    
    def apply_routing_rules(self, ticket):
        """Auto-assign ticket based on category"""
        print(f"Applying routing rules for ticket #{ticket.id}, category: {ticket.category.display_name}")
        
        agent_assignments = AgentDepartment.objects.filter(
            category=ticket.category
        ).select_related('agent')
        
        print(f"Found {agent_assignments.count()} agents for this category")
        
        if agent_assignments.exists():
            primary = agent_assignments.filter(is_primary=True).first()
            if primary:
                ticket.assigned_to = primary.agent
                print(f"Assigned to primary agent: {primary.agent.user.username}")
            else:
                ticket.assigned_to = agent_assignments.first().agent
                print(f"Assigned to agent: {ticket.assigned_to.user.username}")
            ticket.status = 'open'
            ticket.save()
            
            Conversation.objects.create(
                ticket=ticket,
                sender_type='agent',
                message=f"[SYSTEM] Auto-assigned to {ticket.assigned_to.user.username} for {ticket.category.display_name}",
                is_internal_note=True
            )
            return True
        
        print("No agent found for this category")
        return False
    
    def create(self, request, *args, **kwargs):
        data = request.data.copy()
        
        if request.user.is_authenticated:
            try:
                user_profile = UserProfile.objects.get(user=request.user)
                data['raised_by'] = user_profile.id
            except UserProfile.DoesNotExist:
                return Response({"error": "User profile not found. Please complete your profile."}, status=400)
        
        serializer = self.get_serializer(data=data)
        serializer.is_valid(raise_exception=True)
        
        ticket = serializer.save()
        
        Conversation.objects.create(
            ticket=ticket,
            sender_type='user',
            message=request.data.get('description', ''),
            is_internal_note=False
        )
        
        # ========== AI ANALYSIS ==========
        try:
            ai_result = classify_ticket(ticket.title, ticket.description)
            
            Conversation.objects.create(
                ticket=ticket,
                sender_type='agent',
                message=f"[AI ANALYSIS]\n"
                        f"Category: {ai_result.get('category', 'N/A')}\n"
                        f"Priority: {ai_result.get('priority', 'N/A')}\n"
                        f"Sentiment: {ai_result.get('sentiment', 'N/A')}\n"
                        f"Summary: {ai_result.get('summary', 'N/A')}",
                is_internal_note=True
            )
            print(f"✨ AI analysis added to ticket #{ticket.id}")
        except Exception as e:
            print(f"⚠️ AI analysis failed: {e}")
        # =================================
        
        self.apply_routing_rules(ticket)
        
        try:
            from .email_utils import send_ticket_confirmation
            send_ticket_confirmation(ticket)
        except Exception as e:
            print(f"Email sending failed: {e}")
        
        headers = self.get_success_headers(serializer.data)
        return Response(serializer.data, status=status.HTTP_201_CREATED, headers=headers)
    
    @action(detail=True, methods=['get'])
    def status(self, request, pk=None):
        try:
            ticket = self.get_object()
            email = request.query_params.get('email')
            
            if not email or ticket.raised_by.user.email != email:
                return Response(
                    {"error": "Invalid email or ticket ID"}, 
                    status=status.HTTP_404_NOT_FOUND
                )
            
            serializer = TicketSerializer(ticket, context={'request': request})
            return Response(serializer.data)
            
        except Exception:
            return Response(
                {"error": "Ticket not found"}, 
                status=status.HTTP_404_NOT_FOUND
            )
    
    @action(detail=False, methods=['post'], authentication_classes=[], permission_classes=[])
    def public_create(self, request):
        email = request.data.get('email', '')
        recent_tickets = Ticket.objects.filter(
            raised_by__user__email=email,
            created_at__gte=timezone.now() - timezone.timedelta(hours=1)
        ).count()
        
        if recent_tickets >= 3:
            return Response({
                "error": "Too many tickets from this email. Please wait."
            }, status=429)
        
        if not re.match(r"[^@]+@[^@]+\.[^@]+", email):
            return Response({"error": "Invalid email format"}, status=400)
        
        spam_keywords = ['viagra', 'casino', 'lottery', 'porn', 'sex', 'gambling']
        content = f"{request.data.get('title', '')} {request.data.get('description', '')}".lower()
        if any(keyword in content for keyword in spam_keywords):
            return Response({"error": "Content flagged as spam"}, status=400)
        
        data = request.data.copy()
        if not data.get('priority'):
            data['priority'] = 'medium'
        
        serializer = PublicTicketSerializer(data=data)
        if serializer.is_valid():
            ticket = serializer.save()
            
            Conversation.objects.create(
                ticket=ticket,
                sender_type='user',
                message=request.data.get('description', ''),
                is_internal_note=False
            )
            
            Conversation.objects.create(
                ticket=ticket,
                sender_type='agent',
                message=f"Thank you for contacting support. Your ticket #{ticket.id} has been created. We'll respond within 24 hours.",
                is_internal_note=False
            )
            
            # ========== AI ANALYSIS FOR PUBLIC TICKETS ==========
            try:
                ai_result = classify_ticket(ticket.title, ticket.description)
                Conversation.objects.create(
                    ticket=ticket,
                    sender_type='agent',
                    message=f"[AI ANALYSIS]\n"
                            f"Category: {ai_result.get('category', 'N/A')}\n"
                            f"Priority: {ai_result.get('priority', 'N/A')}\n"
                            f"Sentiment: {ai_result.get('sentiment', 'N/A')}\n"
                            f"Summary: {ai_result.get('summary', 'N/A')}",
                    is_internal_note=True
                )
                print(f"✨ AI analysis added to public ticket #{ticket.id}")
            except Exception as e:
                print(f"⚠️ AI analysis failed: {e}")
            # ===================================================
            
            self.apply_routing_rules(ticket)
            
            try:
                from .email_utils import send_ticket_confirmation
                send_ticket_confirmation(ticket)
            except Exception as e:
                print(f"Email sending failed: {e}")
            
            return Response({
                'success': True,
                'ticket_id': ticket.id,
                'message': 'Your ticket has been created. Check your email for confirmation.'
            }, status=status.HTTP_201_CREATED)
        
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
    
    # ========== CUSTOMER REPLY ENDPOINT ==========
    @action(detail=True, methods=['post'], authentication_classes=[], permission_classes=[])
    def add_user_reply(self, request, pk=None):
        """Allow users to add reply to their ticket (no login required)"""
        ticket = self.get_object()
        email = request.data.get('email')
        message = request.data.get('message')
        
        # Verify email matches ticket user
        if not email or ticket.raised_by.user.email != email:
            return Response({"error": "Unauthorized - Email does not match ticket"}, status=401)
        
        if not message or not message.strip():
            return Response({"error": "Message is required"}, status=400)
        
        # Create conversation
        conversation = Conversation.objects.create(
            ticket=ticket,
            sender_type='user',
            message=message.strip(),
            is_internal_note=False
        )
        
        # Update ticket status to open if it was resolved/closed
        if ticket.status in ['resolved', 'closed']:
            ticket.status = 'open'
            ticket.save()
        
        # Notify agents about new reply (optional email)
        print(f"📨 User reply added to ticket #{ticket.id}")
        
        serializer = ConversationSerializer(conversation, context={'request': request})
        return Response({
            "success": True,
            "conversation": serializer.data,
            "message": "Your reply has been added successfully"
        }, status=status.HTTP_201_CREATED)
    # ============================================
    
    @action(detail=True, methods=['post'])
    def assign(self, request, pk=None):
        ticket = self.get_object()
        agent_id = request.data.get('agent_id')
        
        if not agent_id:
            return Response({"error": "agent_id required"}, status=400)
        
        try:
            agent = Agent.objects.get(id=agent_id)
            old_assignee = ticket.assigned_to
            ticket.assigned_to = agent
            ticket.status = 'open'
            ticket.save()
            
            Conversation.objects.create(
                ticket=ticket,
                sender_type='agent',
                message=f"[SYSTEM] Ticket assigned to {agent.user.username}",
                is_internal_note=True
            )
            
            return Response({
                "status": "assigned", 
                "agent": agent.user.username,
                "previous_assignee": old_assignee.user.username if old_assignee else None
            })
        except Agent.DoesNotExist:
            return Response({"error": "Agent not found"}, status=404)
    
    @action(detail=True, methods=['post'])
    def add_conversation(self, request, pk=None):
        ticket = self.get_object()
        
        is_internal = request.data.get('is_internal_note', False)
        sender = request.data.get('sender_type', 'agent')
        
        conversation = Conversation.objects.create(
            ticket=ticket,
            sender_type=sender,
            message=request.data['message'],
            is_internal_note=is_internal
        )
        
        if sender == 'agent' and not is_internal:
            try:
                from .email_utils import send_reply_notification
                send_reply_notification(ticket, conversation)
            except Exception as e:
                print(f"Reply email sending failed: {e}")
        
        serializer = ConversationSerializer(conversation, context={'request': request})
        return Response(serializer.data, status=status.HTTP_201_CREATED)
    
    @action(detail=True, methods=['get'])
    def conversations(self, request, pk=None):
        ticket = self.get_object()
        conversations = Conversation.objects.filter(ticket=ticket).order_by('created_at')
        serializer = ConversationSerializer(conversations, many=True, context={'request': request})
        return Response(serializer.data)
    
    @action(detail=True, methods=['post'])
    def resolve(self, request, pk=None):
        ticket = self.get_object()
        ticket.status = 'resolved'
        ticket.resolved_at = timezone.now()
        ticket.save()
        
        Conversation.objects.create(
            ticket=ticket,
            sender_type='agent',
            message="[SYSTEM] Ticket marked as resolved",
            is_internal_note=True
        )
        
        return Response({"status": "resolved"})
    
    @action(detail=True, methods=['post'])
    def reroute(self, request, pk=None):
        ticket = self.get_object()
        applied = self.apply_routing_rules(ticket)
        if applied:
            return Response({"status": "rerouted", "ticket": TicketSerializer(ticket, context={'request': request}).data})
        return Response({"status": "no rules applied", "ticket": TicketSerializer(ticket, context={'request': request}).data})
    
    @action(detail=True, methods=['post'])
    def quick_resolve(self, request, pk=None):
        ticket = self.get_object()
        old_status = ticket.status
        ticket.status = 'resolved'
        ticket.resolved_at = timezone.now()
        ticket.save()
        
        Conversation.objects.create(
            ticket=ticket,
            sender_type='agent',
            message=f"[SYSTEM] Ticket resolved by {request.user.username if request.user.is_authenticated else 'Agent'}",
            is_internal_note=True
        )
        
        return Response({
            "status": "resolved",
            "ticket_id": ticket.id,
            "previous_status": old_status
        })
    
    @action(detail=True, methods=['post'])
    def quick_assign_to_me(self, request, pk=None):
        ticket = self.get_object()
        
        try:
            agent = Agent.objects.get(user=request.user)
            old_assignee = ticket.assigned_to
            ticket.assigned_to = agent
            ticket.status = 'open'
            ticket.save()
            
            Conversation.objects.create(
                ticket=ticket,
                sender_type='agent',
                message=f"[SYSTEM] Ticket assigned to {agent.user.username}",
                is_internal_note=True
            )
            
            return Response({
                "status": "assigned",
                "ticket_id": ticket.id,
                "assigned_to": agent.user.username,
                "previous_assignee": old_assignee.user.username if old_assignee else None
            })
        except Agent.DoesNotExist:
            return Response({"error": "You are not registered as an agent"}, status=400)
    
    @action(detail=True, methods=['post'])
    def quick_status_change(self, request, pk=None):
        ticket = self.get_object()
        new_status = request.data.get('status')
        
        if new_status not in dict(Ticket.STATUS_CHOICES):
            return Response({"error": f"Invalid status. Choose from: {list(dict(Ticket.STATUS_CHOICES).keys())}"}, status=400)
        
        old_status = ticket.status
        ticket.status = new_status
        
        if new_status == 'resolved':
            ticket.resolved_at = timezone.now()
        
        ticket.save()
        
        Conversation.objects.create(
            ticket=ticket,
            sender_type='agent',
            message=f"[SYSTEM] Status changed from {old_status} to {new_status} by {request.user.username if request.user.is_authenticated else 'Agent'}",
            is_internal_note=True
        )
        
        return Response({
            "status": "updated",
            "ticket_id": ticket.id,
            "old_status": old_status,
            "new_status": new_status
        })
    
    @action(detail=True, methods=['post'])
    def quick_note(self, request, pk=None):
        ticket = self.get_object()
        note = request.data.get('note')
        
        if not note:
            return Response({"error": "note is required"}, status=400)
        
        conversation = Conversation.objects.create(
            ticket=ticket,
            sender_type='agent',
            message=note,
            is_internal_note=True
        )
        
        return Response({
            "status": "note_added",
            "note_id": conversation.id,
            "message": "Internal note added successfully"
        })
    
    @action(detail=True, methods=['get'])
    def quick_summary(self, request, pk=None):
        ticket = self.get_object()
        
        recent = ticket.conversations.order_by('-created_at')[:3]
        now = timezone.now()
        age_hours = (now - ticket.created_at).total_seconds() / 3600
        
        attachments_count = ticket.attachments.count()
        
        return Response({
            "ticket_id": ticket.id,
            "title": ticket.title,
            "raised_by": ticket.raised_by.user.get_full_name() or ticket.raised_by.user.username,
            "raised_by_email": ticket.raised_by.user.email,
            "category": ticket.category.display_name,
            "status": ticket.status,
            "priority": ticket.priority,
            "age_hours": round(age_hours, 1),
            "assigned_to": ticket.assigned_to.user.username if ticket.assigned_to else None,
            "total_attachments": attachments_count,
            "recent_activity": [
                {
                    "type": "note" if c.is_internal_note else "message",
                    "from": c.sender_name,
                    "time": c.created_at,
                    "preview": c.message[:50] + "..." if len(c.message) > 50 else c.message
                }
                for c in recent
            ]
        })
    
    @action(detail=False, methods=['post'])
    def ai_analyze(self, request):
        title = request.data.get('title', '')
        description = request.data.get('description', '')
        
        if not title or not description:
            return Response({"error": "title and description required"}, status=400)
        
        analysis = classify_ticket(title, description)
        return Response(analysis)
    
    @action(detail=True, methods=['post'])
    def ai_suggest_response(self, request, pk=None):
        try:
            ticket = self.get_object()
            
            latest_conversation = ticket.conversations.filter(
                sender_type='user'
            ).last()
            
            if not latest_conversation:
                return Response({"error": "No user message found"}, status=400)
            
            from .ai_services import generate_canned_response
            suggested = generate_canned_response(
                ticket.title,
                latest_conversation.message
            )
            
            if isinstance(suggested, dict):
                suggested = suggested.get('suggested_response', str(suggested))
            
            return Response({"suggested_response": suggested})
            
        except Exception as e:
            print(f"AI suggest error: {e}")
            import traceback
            traceback.print_exc()
            return Response({"error": str(e)}, status=500)
    
    @action(detail=False, methods=['get'])
    def ai_status(self, request):
        health = check_ai_health()
        return Response(health)


class ConversationViewSet(viewsets.ModelViewSet):
    queryset = Conversation.objects.all()
    serializer_class = ConversationSerializer
    
    def get_queryset(self):
        queryset = Conversation.objects.all()
        ticket_id = self.request.query_params.get('ticket', None)
        if ticket_id:
            queryset = queryset.filter(ticket_id=ticket_id)
        return queryset
    
    def get_serializer_context(self):
        context = super().get_serializer_context()
        context['request'] = self.request
        return context


class TicketAttachmentViewSet(viewsets.ModelViewSet):
    queryset = TicketAttachment.objects.all()
    serializer_class = TicketAttachmentSerializer
    parser_classes = (MultiPartParser, FormParser, JSONParser)
    
    def get_queryset(self):
        queryset = TicketAttachment.objects.all()
        ticket_id = self.request.query_params.get('ticket', None)
        if ticket_id:
            queryset = queryset.filter(ticket_id=ticket_id)
        return queryset
    
    def get_serializer_context(self):
        context = super().get_serializer_context()
        context['request'] = self.request
        return context
    
    def create(self, request, *args, **kwargs):
        file_obj = request.FILES.get('file')
        ticket_id = request.data.get('ticket')
        uploaded_by = request.data.get('uploaded_by', 'user')
        
        if not file_obj:
            return Response({"error": "No file provided"}, status=400)
        
        if not ticket_id:
            return Response({"error": "ticket_id required"}, status=400)
        
        if file_obj.size > 5 * 1024 * 1024:
            return Response({"error": "File size exceeds 5MB limit"}, status=400)
        
        try:
            ticket = Ticket.objects.get(id=ticket_id)
            
            attachment = TicketAttachment.objects.create(
                ticket=ticket,
                file=file_obj,
                filename=file_obj.name,
                file_size=file_obj.size,
                uploaded_by=uploaded_by
            )
            
            serializer = self.get_serializer(attachment)
            return Response(serializer.data, status=201)
            
        except Ticket.DoesNotExist:
            return Response({"error": "Ticket not found"}, status=404)
    
    @action(detail=False, methods=['get'])
    def by_ticket(self, request):
        ticket_id = request.query_params.get('ticket_id')
        if not ticket_id:
            return Response({"error": "ticket_id required"}, status=400)
        
        attachments = TicketAttachment.objects.filter(ticket_id=ticket_id)
        serializer = self.get_serializer(attachments, many=True)
        return Response(serializer.data)


class CannedCategoryViewSet(viewsets.ModelViewSet):
    queryset = CannedCategory.objects.all()
    serializer_class = CannedCategorySerializer
    
    def get_queryset(self):
        queryset = CannedCategory.objects.all()
        college_id = self.request.query_params.get('college', None)
        if college_id:
            queryset = queryset.filter(college_id=college_id)
        return queryset
    
    @action(detail=True, methods=['get'])
    def responses(self, request, pk=None):
        category = self.get_object()
        responses = category.canned_responses.all()
        serializer = CannedResponseSerializer(responses, many=True)
        return Response(serializer.data)


class CannedResponseViewSet(viewsets.ModelViewSet):
    queryset = CannedResponse.objects.all()
    serializer_class = CannedResponseSerializer
    
    def get_queryset(self):
        queryset = CannedResponse.objects.all()
        college_id = self.request.query_params.get('college', None)
        category_id = self.request.query_params.get('category', None)
        department = self.request.query_params.get('department', None)
        
        if college_id:
            queryset = queryset.filter(college_id=college_id)
        if category_id:
            queryset = queryset.filter(category_id=category_id)
        if department:
            queryset = queryset.filter(Q(department=department) | Q(department=''))
        
        return queryset
    
    @action(detail=False, methods=['post'])
    def render(self, request):
        canned_id = request.data.get('canned_response_id')
        ticket_id = request.data.get('ticket_id')
        
        if not canned_id or not ticket_id:
            return Response({"error": "canned_response_id and ticket_id required"}, status=400)
        
        try:
            canned = CannedResponse.objects.get(id=canned_id)
            ticket = Ticket.objects.get(id=ticket_id)
            
            context = ticket.get_variable_context()
            
            rendered = canned.content
            for key, value in context.items():
                placeholder = f'{{{{{key}}}}}'
                rendered = rendered.replace(placeholder, str(value))
            
            canned.usage_count += 1
            canned.save(update_fields=['usage_count'])
            
            return Response({
                'rendered_content': rendered,
                'ticket_id': ticket.id,
                'canned_title': canned.title,
            })
            
        except CannedResponse.DoesNotExist:
            return Response({"error": "Canned response not found"}, status=404)
        except Ticket.DoesNotExist:
            return Response({"error": "Ticket not found"}, status=404)
        except Exception as e:
            print(f"Render error: {str(e)}")
            return Response({"error": str(e)}, status=500)
    
    @action(detail=True, methods=['get'])
    def preview(self, request, pk=None):
        canned = self.get_object()
        sample_data = {
            'raised_by_name': 'John Doe',
            'raised_by_email': 'john@example.com',
            'ticket_id': 123,
            'ticket_title': 'Sample Issue',
            'ticket_status': 'open',
            'category': 'Academic',
            'roll_number': 'CS2024001',
            'student_type': 'Hosteller'
        }
        preview = canned.render(sample_data)
        return Response({
            'preview': preview,
            'variables': canned.variables,
            'original': canned.content
        })
    
    @action(detail=True, methods=['post'])
    def increment_usage(self, request, pk=None):
        canned = self.get_object()
        canned.usage_count += 1
        canned.save(update_fields=['usage_count'])
        return Response({'usage_count': canned.usage_count})
    
    @action(detail=False, methods=['get'])
    def popular(self, request):
        college_id = request.query_params.get('college', 1)
        limit = int(request.query_params.get('limit', 10))
        
        popular = CannedResponse.objects.filter(
            college_id=college_id
        ).order_by('-usage_count')[:limit]
        
        serializer = self.get_serializer(popular, many=True)
        return Response(serializer.data)
    
    @action(detail=False, methods=['get'])
    def by_department(self, request):
        department = request.query_params.get('department', '')
        college_id = request.query_params.get('college', 1)
        
        if department:
            responses = CannedResponse.objects.filter(
                Q(department=department) | Q(department=''),
                college_id=college_id
            )
        else:
            responses = CannedResponse.objects.filter(college_id=college_id)
        
        serializer = self.get_serializer(responses, many=True)
        return Response(serializer.data)
    
    @action(detail=False, methods=['get'])
    def by_shortcode(self, request):
        shortcode = request.query_params.get('code', '')
        college_id = request.query_params.get('college', 1)
        
        if not shortcode:
            return Response({"error": "code parameter required"}, status=400)
        
        try:
            response = CannedResponse.objects.get(
                shortcode=shortcode,
                college_id=college_id
            )
            serializer = self.get_serializer(response)
            return Response(serializer.data)
        except CannedResponse.DoesNotExist:
            return Response({"error": "Canned response not found"}, status=404)


class RoutingRuleViewSet(viewsets.ModelViewSet):
    queryset = RoutingRule.objects.all()
    serializer_class = RoutingRuleSerializer
    
    def get_queryset(self):
        queryset = RoutingRule.objects.all()
        college_id = self.request.query_params.get('college', None)
        if college_id:
            queryset = queryset.filter(college_id=college_id, is_active=True)
        return queryset


class KnowledgeCategoryViewSet(viewsets.ModelViewSet):
    queryset = KnowledgeCategory.objects.all()
    serializer_class = KnowledgeCategorySerializer
    
    def get_queryset(self):
        queryset = KnowledgeCategory.objects.all()
        college_id = self.request.query_params.get('college', None)
        if college_id:
            queryset = queryset.filter(college_id=college_id)
        return queryset
    
    @action(detail=True, methods=['get'])
    def articles(self, request, pk=None):
        category = self.get_object()
        articles = category.articles.filter(is_published=True)
        serializer = KnowledgeArticleSerializer(articles, many=True, context={'request': request})
        return Response(serializer.data)


class KnowledgeArticleViewSet(viewsets.ModelViewSet):
    queryset = KnowledgeArticle.objects.all()
    serializer_class = KnowledgeArticleSerializer
    
    def get_serializer_class(self):
        if self.request.query_params.get('public', 'false').lower() == 'true':
            return PublicKnowledgeArticleSerializer
        return KnowledgeArticleSerializer
    
    def get_queryset(self):
        queryset = KnowledgeArticle.objects.all()
        college_id = self.request.query_params.get('college', None)
        
        if college_id:
            queryset = queryset.filter(college_id=college_id)
        
        category_id = self.request.query_params.get('category', None)
        if category_id:
            queryset = queryset.filter(category_id=category_id)
        
        public = self.request.query_params.get('public', 'false').lower() == 'true'
        if public:
            queryset = queryset.filter(is_published=True, is_public=True)
        
        search = self.request.query_params.get('search', None)
        if search:
            queryset = queryset.filter(
                Q(title__icontains=search) | 
                Q(content__icontains=search) | 
                Q(summary__icontains=search) | 
                Q(tags__icontains=search)
            )
        
        tag = self.request.query_params.get('tag', None)
        if tag:
            queryset = queryset.filter(tags__icontains=tag)
        
        featured = self.request.query_params.get('featured', 'false').lower() == 'true'
        if featured:
            queryset = queryset.filter(is_featured=True)
        
        return queryset
    
    def retrieve(self, request, *args, **kwargs):
        instance = self.get_object()
        
        public = request.query_params.get('public', 'false').lower() == 'true'
        if public:
            instance.increment_views()
        
        serializer = self.get_serializer(instance)
        return Response(serializer.data)
    
    @action(detail=True, methods=['post'])
    def feedback(self, request, pk=None):
        article = self.get_object()
        
        is_helpful = request.data.get('is_helpful')
        if is_helpful is None:
            return Response({"error": "is_helpful required"}, status=400)
        
        if is_helpful:
            article.helpful_count += 1
        else:
            article.not_helpful_count += 1
        article.save()
        
        feedback = ArticleFeedback.objects.create(
            article=article,
            is_helpful=is_helpful,
            comment=request.data.get('comment', ''),
            session_id=request.data.get('session_id', ''),
            user_id=request.data.get('user_id') if request.data.get('user_id') else None
        )
        
        serializer = ArticleFeedbackSerializer(feedback)
        return Response(serializer.data, status=status.HTTP_201_CREATED)
    
    @action(detail=False, methods=['get'])
    def popular(self, request):
        college_id = request.query_params.get('college', 1)
        limit = int(request.query_params.get('limit', 10))
        
        articles = KnowledgeArticle.objects.filter(
            college_id=college_id,
            is_published=True
        ).order_by('-views')[:limit]
        
        serializer = self.get_serializer(articles, many=True)
        return Response(serializer.data)
    
    @action(detail=False, methods=['get'])
    def helpful(self, request):
        college_id = request.query_params.get('college', 1)
        limit = int(request.query_params.get('limit', 10))
        
        articles = KnowledgeArticle.objects.filter(
            college_id=college_id,
            is_published=True
        ).order_by('-helpful_count')[:limit]
        
        serializer = self.get_serializer(articles, many=True)
        return Response(serializer.data)
    
    @action(detail=False, methods=['get'])
    def recent(self, request):
        college_id = request.query_params.get('college', 1)
        limit = int(request.query_params.get('limit', 10))
        
        articles = KnowledgeArticle.objects.filter(
            college_id=college_id,
            is_published=True
        ).order_by('-created_at')[:limit]
        
        serializer = self.get_serializer(articles, many=True)
        return Response(serializer.data)


class ArticleFeedbackViewSet(viewsets.ModelViewSet):
    queryset = ArticleFeedback.objects.all()
    serializer_class = ArticleFeedbackSerializer
    
    def get_queryset(self):
        queryset = ArticleFeedback.objects.all()
        article_id = self.request.query_params.get('article', None)
        if article_id:
            queryset = queryset.filter(article_id=article_id)
        return queryset