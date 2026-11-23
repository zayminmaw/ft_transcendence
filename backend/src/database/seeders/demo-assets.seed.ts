import type { EntityManager } from 'typeorm';
import { Asset } from '../../modules/assets/entities/asset.entity';
import { AssetAssignment } from '../../modules/assets/entities/asset-assignment.entity';
import { AssetMaintenanceLog } from '../../modules/assets/entities/asset-maintenance-log.entity';
import type { AssetValues } from '../../modules/assets/types/asset';
import { Employee } from '../../modules/drivers/entities/employee.entity';

// A check-out to a demo driver (by employee code); without checkedInAt the driver still has the asset.
interface DemoCheckOut {
  driver: string;
  checkedOutAt: string;
  checkedInAt?: string;
  checkoutNotes?: string;
  checkinNotes?: string;
}
type DemoService = Pick<AssetMaintenanceLog, 'serviceDate' | 'serviceType' | 'serviceCost'> &
  Partial<Pick<AssetMaintenanceLog, 'vendorServiceCenter' | 'nextServiceDue' | 'notes'>>;
type DemoAsset = Partial<AssetValues> & Pick<AssetValues, 'assetTag' | 'assetName' | 'category'> & {
  checkOuts?: DemoCheckOut[];
  services?: DemoService[];
};

// The registration details only vehicles have.
const VEHICLE = (plate: string, vin: string, policy: string, roadTax: string) =>
  ({ licensePlate: plate, vin, insurancePolicyNumber: policy, roadTaxExpiry: roadTax });

// Meridian's fleet matches the assets screens' former sample data: Leen and Hadi each have a van (so dispatch has a
// vehicle for them), Samir a bag and a scanner; one van needs maintenance with road tax due, one motorcycle is
// written off.
export const DEMO_ASSETS: Record<string, DemoAsset[]> = {
  'meridian-courier': [
    {
      assetTag: 'AST-001', assetName: 'Toyota Hiace', category: 'van', acquisitionCost: '24500.00', currentBookValue: '19600.00',
      ...VEHICLE('21-48812', 'JTFSS22P0K0123456', 'VAN-55021', '2027-02-28'), currentCondition: 'good',
      checkOuts: [
        { driver: 'DRV-001', checkedOutAt: '2026-10-28T07:20:00Z', checkedInAt: '2026-10-28T18:05:00Z', checkinNotes: 'No issues' },
        { driver: 'DRV-001', checkedOutAt: '2026-10-29T07:30:00Z', checkoutNotes: 'Fuel full, 84,210 km' },
      ],
      services: [{
        serviceDate: '2026-09-14', serviceType: 'Oil and filter change', serviceCost: '85.00', vendorServiceCenter: 'Al Wehdat Auto Service',
        nextServiceDue: '2026-12-14',
      }],
    },
    {
      assetTag: 'AST-002', assetName: 'Toyota Hiace', category: 'van', acquisitionCost: '24500.00', currentBookValue: '18900.00',
      ...VEHICLE('21-48813', 'JTFSS22P0K0123457', 'VAN-55022', '2026-11-10'), currentCondition: 'needs_maintenance',
      notes: 'Brakes squeal under load.',
      checkOuts: [{
        driver: 'DRV-003', checkedOutAt: '2026-10-20T07:10:00Z', checkedInAt: '2026-10-27T17:40:00Z', checkinNotes: 'Brakes squeal under load',
      }],
      services: [{
        serviceDate: '2026-06-02', serviceType: 'Annual inspection', serviceCost: '140.00', vendorServiceCenter: 'Al Wehdat Auto Service',
        nextServiceDue: '2026-10-25', notes: 'Front pads at 30%.',
      }],
    },
    {
      assetTag: 'AST-003', assetName: 'Hyundai H100', category: 'van', acquisitionCost: '19800.00', currentBookValue: '12400.00',
      ...VEHICLE('21-50290', 'KMFZCZ7KAJU004821', 'VAN-49110', '2027-06-30'), currentCondition: 'good',
      checkOuts: [{ driver: 'DRV-003', checkedOutAt: '2026-10-29T06:55:00Z' }],
    },
    {
      assetTag: 'AST-004', assetName: 'Honda Wave 110', category: 'motorcycle', acquisitionCost: '1450.00', currentBookValue: '1450.00',
      ...VEHICLE('31-11902', 'MLHJA3920P5100231', 'MC-77012', '2027-09-15'), currentCondition: 'new',
    },
    {
      assetTag: 'AST-005', assetName: 'Thermal bag, large', category: 'thermal_bag', acquisitionCost: '45.00', currentBookValue: '30.00',
      checkOuts: [{ driver: 'DRV-002', checkedOutAt: '2026-10-01T08:00:00Z' }],
    },
    {
      assetTag: 'AST-006', assetName: 'Zebra TC21 scanner', category: 'barcode_scanner', acquisitionCost: '620.00', currentBookValue: '480.00',
      notes: 'Serial 21334B7720',
      checkOuts: [{ driver: 'DRV-002', checkedOutAt: '2026-10-01T08:00:00Z', checkoutNotes: 'With charging cradle' }],
    },
    {
      assetTag: 'AST-007', assetName: 'Sunmi P2 card terminal', category: 'mobile_pos', acquisitionCost: '310.00', currentBookValue: '260.00',
    },
    {
      assetTag: 'AST-008', assetName: 'Honda Wave 110', category: 'motorcycle', acquisitionCost: '1400.00', currentBookValue: '0.00',
      licensePlate: '31-09877', vin: 'MLHJA3920M5098812', roadTaxExpiry: '2026-08-01', currentCondition: 'decommissioned',
      notes: 'Written off after an accident in July 2026.',
      checkOuts: [{
        driver: 'DRV-002', checkedOutAt: '2026-06-01T08:00:00Z', checkedInAt: '2026-07-18T16:00:00Z',
        checkinNotes: 'Damaged in an accident, frame bent',
      }],
    },
  ],
  'harbor-express': [
    {
      assetTag: 'HX-AST-01', assetName: 'Ford Transit', category: 'van', acquisitionCost: '27000.00', currentBookValue: '23500.00',
      ...VEHICLE('22-70114', 'WF0XXXTTGXKA12345', 'VAN-80011', '2027-04-30'), currentCondition: 'good',
      checkOuts: [{ driver: 'HX-DRV-01', checkedOutAt: '2026-10-29T06:40:00Z' }],
    },
    {
      assetTag: 'HX-AST-02', assetName: 'Thermal bag, medium', category: 'thermal_bag', acquisitionCost: '35.00', currentBookValue: '30.00',
    },
  ],
};

// Adds each company's missing assets (by tag) with their history; existing ones are left unchanged. Run after the
// drivers. Returns how many were added.
export async function seedDemoAssets(manager: EntityManager, companyIds: Map<string, string>): Promise<number> {
  let created = 0;
  for (const [company, assets] of Object.entries(DEMO_ASSETS)) {
    const organizationId = companyIds.get(company)!;
    for (const { checkOuts = [], services = [], ...values } of assets) {
      if (await manager.existsBy(Asset, { organizationId, assetTag: values.assetTag })) continue;
      const { identifiers } = await manager.insert(Asset, { ...values, organizationId });
      const assetId = String(identifiers[0]?.id);
      for (const { driver, checkedOutAt, checkedInAt, checkoutNotes, checkinNotes } of checkOuts) {
        const employee = await manager.findOneByOrFail(Employee, { organizationId, employeeCode: driver });
        await manager.insert(AssetAssignment, {
          assetId, driverId: employee.id, checkedOutAt: new Date(checkedOutAt), checkedInAt: checkedInAt ? new Date(checkedInAt) : null,
          checkoutNotes: checkoutNotes ?? null, checkinNotes: checkinNotes ?? null,
        });
      }
      for (const service of services) await manager.insert(AssetMaintenanceLog, { ...service, assetId });
      created += 1;
    }
  }
  return created;
}
