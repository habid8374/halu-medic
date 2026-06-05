from django.urls import path
from . import views

urlpatterns = [
    path('Patient/<uuid:paciente_id>/',        views.fhir_patient,           name='fhir-patient'),
    path('Encounter/<uuid:consulta_id>/',       views.fhir_encounter,         name='fhir-encounter'),
    path('MedicationRequest/<uuid:orden_id>/', views.fhir_medication_request, name='fhir-med-request'),
    path('ServiceRequest/<uuid:orden_id>/',    views.fhir_service_request,    name='fhir-service-request'),
]
