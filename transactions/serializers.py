from rest_framework import serializers
from .models import Category, Transaction, Budget, RecurringTransaction
from django.contrib.auth import get_user_model

User = get_user_model()


class CategorySerializer(serializers.ModelSerializer):
    transaction_count = serializers.SerializerMethodField()
    
    class Meta:
        model = Category
        fields = ['id', 'name', 'type', 'description', 'icon', 'color', 'is_active', 
                  'created_at', 'updated_at', 'transaction_count']
        read_only_fields = ['created_at', 'updated_at']
    
    def get_transaction_count(self, obj):
        return obj.transactions.count()


class TransactionSerializer(serializers.ModelSerializer):
    category_name = serializers.CharField(source='category.name', read_only=True)
    category_color = serializers.CharField(source='category.color', read_only=True)
    
    class Meta:
        model = Transaction
        fields = ['id', 'category', 'category_name', 'category_color', 'amount', 'currency', 
                  'type', 'description', 'date', 'receipt', 'is_recurring', 'notes', 
                  'created_at', 'updated_at']
        read_only_fields = ['type', 'created_at', 'updated_at']
    
    def validate_amount(self, value):
        if value <= 0:
            raise serializers.ValidationError("Amount must be greater than zero.")
        return value
    
    def validate_category(self, value):
        user = self.context['request'].user
        if value.user != user:
            raise serializers.ValidationError("Invalid category.")
        return value


class BudgetSerializer(serializers.ModelSerializer):
    category_name = serializers.CharField(source='category.name', read_only=True)
    spent_amount = serializers.SerializerMethodField()
    remaining_amount = serializers.SerializerMethodField()
    percentage_used = serializers.SerializerMethodField()
    is_over_budget = serializers.SerializerMethodField()
    should_alert = serializers.SerializerMethodField()
    
    class Meta:
        model = Budget
        fields = ['id', 'category', 'category_name', 'amount', 'currency', 'period', 
                  'start_date', 'end_date', 'alert_threshold', 'is_active', 
                  'spent_amount', 'remaining_amount', 'percentage_used', 
                  'is_over_budget', 'should_alert', 'created_at', 'updated_at']
        read_only_fields = ['created_at', 'updated_at']
    
    def get_spent_amount(self, obj):
        return float(obj.get_spent_amount())
    
    def get_remaining_amount(self, obj):
        return float(obj.get_remaining_amount())
    
    def get_percentage_used(self, obj):
        return round(obj.get_percentage_used(), 2)
    
    def get_is_over_budget(self, obj):
        return obj.is_over_budget()
    
    def get_should_alert(self, obj):
        return obj.should_alert()
    
    def validate_category(self, value):
        user = self.context['request'].user
        if value.user != user:
            raise serializers.ValidationError("Invalid category.")
        if value.type != 'expense':
            raise serializers.ValidationError("Budgets can only be set for expense categories.")
        return value


class RecurringTransactionSerializer(serializers.ModelSerializer):
    category_name = serializers.CharField(source='category.name', read_only=True)
    
    class Meta:
        model = RecurringTransaction
        fields = ['id', 'category', 'category_name', 'amount', 'currency', 'type', 
                  'description', 'frequency', 'start_date', 'end_date', 'next_occurrence', 
                  'is_active', 'created_at', 'updated_at']
        read_only_fields = ['type', 'created_at', 'updated_at']


class DashboardStatsSerializer(serializers.Serializer):
    """Serializer for dashboard statistics"""
    total_income = serializers.DecimalField(max_digits=12, decimal_places=2)
    total_expenses = serializers.DecimalField(max_digits=12, decimal_places=2)
    net_savings = serializers.DecimalField(max_digits=12, decimal_places=2)
    transaction_count = serializers.IntegerField()
    category_count = serializers.IntegerField()
    budget_count = serializers.IntegerField()
    expense_by_category = serializers.ListField()
    income_by_category = serializers.ListField()
    recent_transactions = TransactionSerializer(many=True)
