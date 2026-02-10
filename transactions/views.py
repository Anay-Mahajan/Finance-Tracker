# All transaction views removed - using API-only backend
# All transaction functionality is handled via:
# 1. /api/transactions/ (TransactionViewSet)
# 2. /api/categories/ (CategoryViewSet)  
# 3. /api/budgets/ (BudgetViewSet)
# 4. React frontend handles all UI
    
    # if request.method == 'POST':
    #     form = TransactionForm(request.POST, request.FILES, user=request.user, transaction_type=transaction_type)
    #     if form.is_valid():
    #         transaction = form.save(commit=False)
    #         transaction.user = request.user
    #         transaction.type = transaction_type
    #         transaction.save()
    #         messages.success(request, f'{transaction_type.capitalize()} transaction added successfully!')
    #         return redirect('transaction_list')
    # else:
    #     form = TransactionForm(user=request.user, transaction_type=transaction_type)
    
    # context = {
    #     'form': form,
    #     'transaction_type': transaction_type,
    #     'action': 'Create',
    # }
    # return render(request, 'transactions/transaction_form.html', context)


@login_required
def transaction_update(request, pk):
    """Update an existing transaction"""
    transaction = get_object_or_404(Transaction, pk=pk, user=request.user)
    
    if request.method == 'POST':
        form = TransactionForm(request.POST, request.FILES, instance=transaction, user=request.user, transaction_type=transaction.type)
        if form.is_valid():
            form.save()
            messages.success(request, 'Transaction updated successfully!')
            return redirect('transaction_list')
    else:
        form = TransactionForm(instance=transaction, user=request.user, transaction_type=transaction.type)
    
    context = {
        'form': form,
        'transaction': transaction,
        'transaction_type': transaction.type,
        'action': 'Update',
    }
    return render(request, 'transactions/transaction_form.html', context)


@login_required
def transaction_delete(request, pk):
    """Delete a transaction"""
    transaction = get_object_or_404(Transaction, pk=pk, user=request.user)
    
    if request.method == 'POST':
        transaction.delete()
        messages.success(request, 'Transaction deleted successfully!')
        return redirect('transaction_list')
    
    context = {'transaction': transaction}
    return render(request, 'transactions/transaction_confirm_delete.html', context)


@login_required
def category_list(request):
    """List all categories"""
    categories = Category.objects.filter(user=request.user)
    context = {'categories': categories}
    return render(request, 'transactions/category_list.html', context)


@login_required
def category_create(request):
    """Create a new category"""
    if request.method == 'POST':
        form = CategoryForm(request.POST)
        if form.is_valid():
            category = form.save(commit=False)
            category.user = request.user
            category.save()
            messages.success(request, 'Category created successfully!')
            return redirect('category_list')
    else:
        form = CategoryForm()
    
    context = {'form': form, 'action': 'Create'}
    return render(request, 'transactions/category_form.html', context)


@login_required
def category_update(request, pk):
    """Update a category"""
    category = get_object_or_404(Category, pk=pk, user=request.user)
    
    if request.method == 'POST':
        form = CategoryForm(request.POST, instance=category)
        if form.is_valid():
            form.save()
            messages.success(request, 'Category updated successfully!')
            return redirect('category_list')
    else:
        form = CategoryForm(instance=category)
    
    context = {'form': form, 'category': category, 'action': 'Update'}
    return render(request, 'transactions/category_form.html', context)


@login_required
def category_delete(request, pk):
    """Delete a category"""
    category = get_object_or_404(Category, pk=pk, user=request.user)
    
    # Check if category has transactions
    transaction_count = category.transactions.count()
    
    if request.method == 'POST':
        if transaction_count > 0:
            # Option 1: Prevent deletion
            messages.error(request, f'Cannot delete category with {transaction_count} existing transactions. Please delete or reassign transactions first.')
            return redirect('category_list')
            
            # Option 2: Soft delete (mark as inactive)
            # category.is_active = False
            # category.save()
            # messages.success(request, 'Category deactivated successfully!')
        else:
            category.delete()
            messages.success(request, 'Category deleted successfully!')
        return redirect('category_list')
    
    context = {
        'category': category,
        'transaction_count': transaction_count,
    }
    return render(request, 'transactions/category_confirm_delete.html', context)


@login_required
def budget_list(request):
    """List all budgets"""
    budgets = Budget.objects.filter(user=request.user)
    
    # Calculate budget statistics
    for budget in budgets:
        budget.spent = budget.get_spent_amount()
        budget.remaining = budget.get_remaining_amount()
        budget.percentage = budget.get_percentage_used()
    
    context = {'budgets': budgets}
    return render(request, 'transactions/budget_list.html', context)


@login_required
def budget_create(request):
    """Create a new budget"""
    if request.method == 'POST':
        form = BudgetForm(request.POST, user=request.user)
        if form.is_valid():
            budget = form.save(commit=False)
            budget.user = request.user
            budget.save()
            messages.success(request, 'Budget created successfully!')
            return redirect('budget_list')
    else:
        form = BudgetForm(user=request.user)
    
    context = {'form': form, 'action': 'Create'}
    return render(request, 'transactions/budget_form.html', context)


@login_required
def budget_update(request, pk):
    """Update a budget"""
    budget = get_object_or_404(Budget, pk=pk, user=request.user)
    
    if request.method == 'POST':
        form = BudgetForm(request.POST, instance=budget, user=request.user)
        if form.is_valid():
            form.save()
            messages.success(request, 'Budget updated successfully!')
            return redirect('budget_list')
    else:
        form = BudgetForm(instance=budget, user=request.user)
    
    context = {'form': form, 'budget': budget, 'action': 'Update'}
    return render(request, 'transactions/budget_form.html', context)


@login_required
def budget_delete(request, pk):
    """Delete a budget"""
    budget = get_object_or_404(Budget, pk=pk, user=request.user)
    
    if request.method == 'POST':
        budget.delete()
        messages.success(request, 'Budget deleted successfully!')
        return redirect('budget_list')
    
    context = {'budget': budget}
    return render(request, 'transactions/budget_confirm_delete.html', context)
