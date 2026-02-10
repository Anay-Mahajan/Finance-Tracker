from django.shortcuts import render, redirect, HttpResponseRedirect
from django.contrib.auth.decorators import login_required
from .models import Category, Expense, ExpenseLimit
from django.contrib import messages
from django.core.paginator import Paginator
from django.http import JsonResponse
from userpreferences.models import UserPreference
from django.core.mail import send_mail
from django.conf import settings
import datetime
from datetime import date


@login_required(login_url='/authentication/login')
def search_expenses(request):
    if request.method == 'POST':
        search_str = request.POST.get('searchText', '')
        expenses = Expense.objects.filter(
            owner=request.user
        ).filter(
            amount__icontains=search_str
        ) | Expense.objects.filter(
            owner=request.user, date__icontains=search_str
        ) | Expense.objects.filter(
            owner=request.user, description__icontains=search_str
        ) | Expense.objects.filter(
            owner=request.user, category__icontains=search_str
        )

        data = expenses.values()
        return JsonResponse(list(data), safe=False)


@login_required(login_url='/authentication/login')
def index(request):
    categories = Category.objects.all()
    expenses = Expense.objects.filter(owner=request.user)

    sort_order = request.GET.get('sort')

    if sort_order == 'amount_asc':
        expenses = expenses.order_by('amount')
    elif sort_order == 'amount_desc':
        expenses = expenses.order_by('-amount')
    elif sort_order == 'date_asc':
        expenses = expenses.order_by('date')
    elif sort_order == 'date_desc':
        expenses = expenses.order_by('-date')

    paginator = Paginator(expenses, 5)
    page_number = request.GET.get('page')
    page_obj = paginator.get_page(page_number)

    try:
        currency = UserPreference.objects.get(user=request.user).currency
    except UserPreference.DoesNotExist:
        currency = None

    context = {
        'expenses': page_obj,
        'page_obj': page_obj,
        'currency': currency,
        'sort_order': sort_order,
    }
    return render(request, context)


@login_required(login_url='/authentication/login')
def add_expense(request):
    categories = Category.objects.all()
    context = {
        'categories': categories,
        'values': request.POST
    }

    if request.method == 'GET':
        return render(request, context)

    if request.method == 'POST':
        amount = request.POST.get('amount')
        description = request.POST.get('description')
        date_str = request.POST.get('expense_date')
        category = request.POST.get('category')

        if not amount:
            messages.error(request, 'Amount is required')
            return render(request,  context)

        if not description:
            messages.error(request, 'Description is required')
            return render(request,  context)

        try:
            expense_date = datetime.datetime.strptime(date_str, '%Y-%m-%d').date()
            today = datetime.date.today()

            if expense_date > today:
                messages.error(request, 'Date cannot be in the future')
                return render(request, context)

            user = request.user
            expense_limits = ExpenseLimit.objects.filter(owner=user)

            daily_limit = expense_limits.first().daily_expense_limit if expense_limits.exists() else 5000
            total_today = get_expense_of_day(user) + float(amount)

            if total_today > daily_limit:
                subject = 'Daily Expense Limit Exceeded'
                message = f'Hello {user.username},\n\nYou have exceeded your daily expense limit.'
                send_mail(subject, message, settings.EMAIL_HOST_USER, [user.email], fail_silently=False)
                messages.warning(request, 'You exceeded your daily expense limit')

            Expense.objects.create(
                owner=user,
                amount=amount,
                date=expense_date,
                category=category,
                description=description
            )

            messages.success(request, 'Expense saved successfully')
            return redirect('expenses')

        except ValueError:
            messages.error(request, 'Invalid date format')
            return render(request,  context)


@login_required(login_url='/authentication/login')
def expense_edit(request, id):
    expense = Expense.objects.get(pk=id)
    categories = Category.objects.all()

    context = {
        'expense': expense,
        'values': expense,
        'categories': categories
    }

    if request.method == 'GET':
        return render(request, context)

    if request.method == 'POST':
        amount = request.POST.get('amount')
        description = request.POST.get('description')
        date_str = request.POST.get('expense_date')
        category = request.POST.get('category')

        if not amount:
            messages.error(request, 'Amount is required')
            return render(request,context)

        if not description:
            messages.error(request, 'Description is required')
            return render(request,context)

        try:
            expense_date = datetime.datetime.strptime(date_str, '%Y-%m-%d').date()
            today = datetime.date.today()

            if expense_date > today:
                messages.error(request, 'Date cannot be in the future')
                return render(request,context)

            expense.amount = amount
            expense.date = expense_date
            expense.category = category
            expense.description = description
            expense.save()

            messages.success(request, 'Expense updated successfully')
            return redirect('expenses')

        except ValueError:
            messages.error(request, 'Invalid date format')
            return render(request,context)


@login_required(login_url='/authentication/login')
def delete_expense(request, id):
    expense = Expense.objects.get(pk=id)
    expense.delete()
    messages.success(request, 'Expense removed')
    return redirect('expenses')


@login_required(login_url='/authentication/login')
def expense_category_summary(request):
    todays_date = datetime.date.today()
    six_months_ago = todays_date - datetime.timedelta(days=30 * 6)

    expenses = Expense.objects.filter(
        owner=request.user,
        date__gte=six_months_ago,
        date__lte=todays_date
    )

    finalrep = {}
    categories = set(expenses.values_list('category', flat=True))

    for category in categories:
        total = sum(item.amount for item in expenses.filter(category=category))
        finalrep[category] = total

    return JsonResponse({'expense_category_data': finalrep}, safe=False)

def set_expense_limit(request):
    if request.method == "POST":
        daily_limit = request.POST.get('daily_expense_limit')
        existing_limit = ExpenseLimit.objects.filter(owner=request.user).first()

        if existing_limit:
            existing_limit.daily_expense_limit = daily_limit
            existing_limit.save()
        else:
            ExpenseLimit.objects.create(owner=request.user, daily_expense_limit=daily_limit)

        messages.success(request, "Daily Expense Limit Updated Successfully!")
        return HttpResponseRedirect('/preferences/')

    return HttpResponseRedirect('/preferences/')

@login_required(login_url='/authentication/login')
def get_expense_of_day(request):
    current_date = date.today()
    expenses = Expense.objects.filter(owner=request.user, date=current_date)
    return sum(expense.amount for expense in expenses)
