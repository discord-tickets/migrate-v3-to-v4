const { DataTypes } = require('sequelize');
export default sequelize => {
	const { DB_TABLE_PREFIX } = process.env;
	sequelize.define('Guild', {
		blacklist: {
			defaultValue: {
				members: [],
				roles: [],
			},
			get() {
				const raw_value = this.getDataValue('blacklist');
				return raw_value
					? typeof raw_value === 'string'
						? JSON.parse(raw_value)
						: raw_value
					: null;
			},
			type: DataTypes.JSON,
		},
		close_button: {
			defaultValue: false,
			type: DataTypes.BOOLEAN,
		},
		colour: {
			defaultValue: '#009999',
			type: DataTypes.STRING,
		},
		error_colour: {
			defaultValue: 'RED',
			type: DataTypes.STRING,
		},
		footer: {
			defaultValue: 'Discord Tickets by eartharoid',
			type: DataTypes.STRING,
		},
		id: {
			allowNull: false,
			primaryKey: true,
			type: DataTypes.CHAR(19),
		},
		locale: {
			defaultValue: 'en-GB',
			type: DataTypes.STRING,
		},
		log_messages: {
			defaultValue: true,
			type: DataTypes.BOOLEAN,
		},
		success_colour: {
			defaultValue: 'GREEN',
			type: DataTypes.STRING,
		},
		tags: {
			defaultValue: {},
			get() {
				const raw_value = this.getDataValue('tags');
				return raw_value
					? typeof raw_value === 'string'
						? JSON.parse(raw_value)
						: raw_value
					: null;
			},
			type: DataTypes.JSON,
		},
	}, { tableName: DB_TABLE_PREFIX + 'guilds' });
};
