from django.contrib import admin
from .models import Category, Transaction, Budget, RecurringTransaction


@admin.register(Category)
class CategoryAdmin(admin.ModelAdmin):
    list_display = ['name', 'type', 'user', 'is_active', 'created_at']
    list_filter = ['type', 'is_active', 'created_at']
    search_fields = ['name', 'description', 'user__username']
    ordering = ['type', 'name']
    list_per_page = 25


@admin.register(Transaction)
class TransactionAdmin(admin.ModelAdmin):
    list_display = ['description', 'amount', 'currency', 'type', 'category', 'user', 'date', 'created_at']
    list_filter = ['type', 'currency', 'date', 'category', 'created_at']
    search_fields = ['description', 'notes', 'user__username', 'category__name']
    ordering = ['-date', '-created_at']
    date_hierarchy = 'date'
    list_per_page = 25
    
    fieldsets = (
        ('Basic Information', {
            'fields': ('user', 'category', 'type', 'date')
        }),
        ('Amount Details', {
            'fields': ('amount', 'currency')
        }),
        ('Description', {
            'fields': ('description', 'notes')
        }),
        ('Additional', {
            'fields': ('receipt', 'is_recurring')
        }),
    )


@admin.register(Budget)
class BudgetAdmin(admin.ModelAdmin):
    list_display = ['category', 'amount', 'currency', 'period', 'user', 'start_date', 'end_date', 'is_active']
    list_filter = ['period', 'is_active', 'currency', 'created_at']
    search_fields = ['category__name', 'user__username']
    ordering = ['-created_at']
    list_per_page = 25
    
    def get_readonly_fields(self, request, obj=None):
        if obj:  # Editing an existing object
            return ['user', 'category']
        return []


@admin.register(RecurringTransaction)
class RecurringTransactionAdmin(admin.ModelAdmin):
    list_display = ['description', 'amount', 'currency', 'frequency', 'next_occurrence', 'is_active', 'user']
    list_filter = ['frequency', 'type', 'is_active', 'currency']
    search_fields = ['description', 'user__username', 'category__name']
    ordering = ['next_occurrence']
    date_hierarchy = 'next_occurrence'
    list_per_page = 25
