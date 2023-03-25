export class cleanup1679651580149 {
    name = 'cleanup1679651580149'

    async up(queryRunner) {
        await queryRunner.query(`ALTER TABLE "meta" DROP COLUMN "useStarForReactionFallback"`);
    }

    async down(queryRunner) {
        await queryRunner.query(`ALTER TABLE "meta" ADD "useStarForReactionFallback" boolean NOT NULL DEFAULT false`);
    }
}
