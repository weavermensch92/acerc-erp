'use client';

import { LogForm } from '@/components/erp/LogForm';
import type { Site, WasteType, TreatmentPlant } from '@/lib/types/database';

interface Props {
  wasteTypes: WasteType[];
  treatmentPlants: TreatmentPlant[];
  allSites: Site[];
  initialDate: string;
}

export function NewLogForm({ wasteTypes, treatmentPlants, allSites, initialDate }: Props) {
  return (
    <LogForm
      mode="create"
      wasteTypes={wasteTypes}
      treatmentPlants={treatmentPlants}
      allSites={allSites}
      defaults={{
        log_date: initialDate,
        direction: 'in',
        company_id: '',
        company_name: '',
        site_name: '',
        waste_type_name: '',
        treatment_plant_name: '',
        vehicle_no: '',
        weight_total_kg: '',
        weight_tare_kg: '',
        weight_kg: '',
        unit_price: '',
        transport_fee: 0,
        billing_type: 'weight_based',
        note: '',
      }}
    />
  );
}
