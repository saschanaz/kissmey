export const packedFlashSchema = {
	type: 'object',
	properties: {
		id: {
			type: 'string',
			optional: false, nullable: false,
			format: 'id',
			example: 'xxxxxxxxxx',
		},
		createdAt: {
			type: 'string',
			optional: false, nullable: false,
			format: 'date-time',
		},
		updatedAt: {
			type: 'string',
			optional: false, nullable: false,
			format: 'date-time',
		},
		title: {
			type: 'string',
			optional: false, nullable: false,
		},
		summary: {
			type: 'string',
			optional: false, nullable: false,
		},
		script: {
			type: 'string',
			optional: false, nullable: false,
		},
		userId: {
			type: 'string',
			optional: false, nullable: false,
			format: 'id',
		},
		user: {
			type: 'object',
			ref: 'UserLite',
			optional: false, nullable: false,
		},
		likedCount: {
			type: 'number',
			optional: false, nullable: true,
		},
		isLiked: {
			type: 'boolean',
			optional: true, nullable: false,
		},
	},
} as const;
