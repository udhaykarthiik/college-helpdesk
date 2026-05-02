from rest_framework import serializers
from django.contrib.auth.models import User
from tickets.models import Agent, UserProfile, College, Department

class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ('id', 'username', 'email', 'first_name', 'last_name')

class RegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True)
    role = serializers.ChoiceField(choices=['student', 'staff', 'parent', 'agent'], write_only=True)
    roll_number = serializers.CharField(required=False, allow_blank=True, write_only=True)
    employee_id = serializers.CharField(required=False, allow_blank=True, write_only=True)
    student_type = serializers.ChoiceField(choices=['hosteller', 'day_scholar', 'transport_user'], required=False, write_only=True)
    department_id = serializers.IntegerField(required=False, write_only=True)
    
    class Meta:
        model = User
        fields = ('username', 'email', 'password', 'first_name', 'last_name', 'role', 
                  'roll_number', 'employee_id', 'student_type', 'department_id')
    
    def create(self, validated_data):
        role = validated_data.pop('role')
        roll_number = validated_data.pop('roll_number', None)
        employee_id = validated_data.pop('employee_id', None)
        student_type = validated_data.pop('student_type', None)
        department_id = validated_data.pop('department_id', None)
        
        # Convert empty strings to None
        if roll_number == '':
            roll_number = None
        if employee_id == '':
            employee_id = None
        
        # Create user
        user = User.objects.create_user(
            username=validated_data['username'],
            email=validated_data['email'],
            password=validated_data['password'],
            first_name=validated_data.get('first_name', ''),
            last_name=validated_data.get('last_name', '')
        )
        
        # Get or create default college
        college, _ = College.objects.get_or_create(
            name="ABC Institution",
            defaults={'domain': 'abc.edu.in'}
        )
        
        # Get department only if provided (for students and staff)
        department = None
        if department_id and (role in ['student', 'staff']):
            try:
                department = Department.objects.get(id=department_id)
            except Department.DoesNotExist:
                pass
        
        # Create user profile
        UserProfile.objects.create(
            user=user,
            college=college,
            user_type=role,
            roll_number=roll_number if role == 'student' else None,
            employee_id=employee_id if role == 'staff' else None,
            student_type=student_type if role == 'student' else None,
            department=department
        )
        
        # Create agent record if role is agent
        if role == 'agent':
            Agent.objects.create(
                user=user,
                college=college
            )
        
        return user