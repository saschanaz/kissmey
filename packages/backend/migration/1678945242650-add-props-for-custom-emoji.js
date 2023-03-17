export class addPropsForCustomEmoji1678945242650 {
    name = 'addPropsForCustomEmoji1678945242650'

    async up(queryRunner) {
        await queryRunner.query(`ALTER TABLE "emoji" ADD "license" character varying(1024)`);
    }

    async down(queryRunner) {
        await queryRunner.query(`ALTER TABLE "emoji" DROP COLUMN "license"`);
    }
}
