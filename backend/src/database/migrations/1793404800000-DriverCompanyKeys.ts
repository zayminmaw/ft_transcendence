import type { MigrationInterface, QueryRunner } from 'typeorm';

// A driver's license number and login account were unique across every company: a company onboarding a driver
// another company already had was refused, which told it that the other company had them. Both are now unique per
// company. delivery_drivers gains its company's id for its key; the composite foreign key keeps it equal to the
// employee's company.
export class DriverCompanyKeys1793404800000 implements MigrationInterface {
  // MariaDB DDL commits implicitly.
  transaction = false;

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE employees ADD UNIQUE KEY uq_emp_id_org (id, organization_id)');
    await queryRunner.query(`
      ALTER TABLE delivery_drivers
        ADD COLUMN organization_id BIGINT UNSIGNED NULL AFTER employee_id
    `);
    await queryRunner.query(`
      UPDATE delivery_drivers driver
        JOIN employees employee ON employee.id = driver.employee_id
        SET driver.organization_id = employee.organization_id
    `);
    await queryRunner.query(`
      ALTER TABLE delivery_drivers
        MODIFY organization_id BIGINT UNSIGNED NOT NULL,
        DROP INDEX license_number,
        ADD UNIQUE KEY uq_driver_org_license (organization_id, license_number),
        ADD CONSTRAINT fk_driver_employee_org FOREIGN KEY (employee_id, organization_id)
          REFERENCES employees (id, organization_id) ON DELETE CASCADE
    `);
    await queryRunner.query(`
      ALTER TABLE employees
        DROP INDEX user_id,
        ADD UNIQUE KEY uq_emp_org_user (organization_id, user_id)
    `);
  }

  // Fails if two companies now share a license number or an account, like the keys it restores.
  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE employees
        DROP INDEX uq_emp_org_user,
        ADD UNIQUE KEY user_id (user_id)
    `);
    await queryRunner.query(`
      ALTER TABLE delivery_drivers
        DROP FOREIGN KEY fk_driver_employee_org,
        DROP INDEX uq_driver_org_license,
        ADD UNIQUE KEY license_number (license_number)
    `);
    await queryRunner.query('ALTER TABLE delivery_drivers DROP INDEX fk_driver_employee_org');
    await queryRunner.query('ALTER TABLE delivery_drivers DROP COLUMN organization_id');
    await queryRunner.query('ALTER TABLE employees DROP INDEX uq_emp_id_org');
  }
}
