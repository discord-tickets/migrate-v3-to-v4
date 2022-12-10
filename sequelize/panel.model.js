const { DataTypes } = require('sequelize');
export default sequelize => {
	const { DB_TABLE_PREFIX } = process.env;
	sequelize.define('Panel', {
		category: {
			allowNull: true,
			type: DataTypes.CHAR(19),
		},
		channel: {
			allowNull: false,
			type: DataTypes.CHAR(19),
		},
		guild: {
			allowNull: false,
			references: {
				key: 'id',
				model: DB_TABLE_PREFIX + 'guilds',
			},
			type: DataTypes.CHAR(19),
		},
	}, { tableName: DB_TABLE_PREFIX + 'panels' });
};