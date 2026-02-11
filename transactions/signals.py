print("signals.py loaded ✅")

from django.db.models.signals import post_save
from django.dispatch import receiver
from django.conf import settings
from .models import Category
from .default_categories import DEFAULT_CATEGORIES

User = settings.AUTH_USER_MODEL

@receiver(post_save, sender=User)
def create_default_categories(sender, instance, created, **kwargs):
    if created:
        print("Creating default categories for", instance.username)
        Category.objects.bulk_create([
            Category(
                user=instance,
                name=cat["name"],
                type=cat["type"],
                color=cat["color"]
            )
            for cat in DEFAULT_CATEGORIES
        ])
