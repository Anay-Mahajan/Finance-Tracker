from django.shortcuts import redirect


def home(request):
    """Redirect to React frontend"""
    return redirect('http://localhost:5173')


# All other views removed - using API-only backend with React frontend
