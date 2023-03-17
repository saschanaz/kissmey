export class roleDisplayOrder1678602320354 {
    name = 'roleDisplayOrder1678602320354'

    async up(queryRunner) {
        await queryRunner.query(`ALTER TABLE "role" ADD "displayOrder" integer NOT NULL DEFAULT '0'`);
    }

    async down(queryRunner) {
        await queryRunner.query(`ALTER TABLE "role" DROP COLUMN "displayOrder"`);
    }
}
