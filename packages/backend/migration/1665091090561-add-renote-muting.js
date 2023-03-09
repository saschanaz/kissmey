
export class addRenoteMuting1665091090561 {
	constructor() {
		this.name = 'addRenoteMuting1665091090561';
	}

	async up(queryRunner) {
		await queryRunner.query(`CREATE TABLE "renote_muting" ("id" character varying(32) NOT NULL, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL, "muteeId" character varying(32) NOT NULL, "muterId" character varying(32) NOT NULL, CONSTRAINT "PK_renoteMuting_id" PRIMARY KEY ("id"))`);
		await queryRunner.query(`CREATE INDEX "IDX_renote_muting_createdAt" ON "muting" ("createdAt") `);
		await queryRunner.query(`CREATE INDEX "IDX_renote_muting_muteeId" ON "muting" ("muteeId") `);
		await queryRunner.query(`CREATE INDEX "IDX_renote_muting_muterId" ON "muting" ("muterId") `);
	}

	async down(queryRunner) {
	}
}
