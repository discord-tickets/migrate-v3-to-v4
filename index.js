import { program } from 'commander';
import { colours } from 'leeks.js';
import { PrismaClient } from '@prisma/client';
import SQLiteMiddleware from './prisma/sqlite.js';
import { Sequelize } from 'sequelize';
import { readdirSync } from 'fs';

program
	.option('-s, --sqlite <file>', 'v3 sqlite database file')
	.option('-k, --key <key>', 'encryption key')
	.option('--v3 <url>', 'v3 database connection string')
	.option('--v4 <url>', 'v4 database connection string')
	.option('-p, --prefix <prefix>', 'v3 database table prefix', 'dsctickets_');

program.parse(process.argv);
const options = program.opts();

if (!options.key) {
	console.error(colours.red('Encryption key is required'));
	process.exit(1);
}

if (options.prefix) process.env.DB_TABLE_PREFIX = options.prefix;

if (!options.sqlite) {
	if (!options.v3 || !options.v4) {
		console.error(colours.red('v3 and v4 database connection strings are required if not using sqlite'));
		process.exit(1);
	}
	process.env.V4_DB = options.v4;
}

const type = options.sqlite ? 'sqlite' : options.v3.startsWith('mysql') ? ' mysql' : 'postgresql';

// v3
const sequelize = new Sequelize(
	type === 'sqlite'
		? {
			dialect: 'sqlite',
			storage: options.sqlite,
		}
		: options.v3,
);
const models = readdirSync('./sequelize').filter(filename => filename.endsWith('.model.js'));
for (const model of models) require(`./models/${model}`)(sequelize);
await sequelize.sync();

// v4
const prisma = new PrismaClient();
if (type === 'sqlite') prisma.$use(SQLiteMiddleware);

// migrate to v4

sequelize.models.Guild.findAll().then(async guilds => {
	for (const v3 of guilds) {
		console.log(`Migrating guild ${v3.id}...`);
		try {
			await prisma.guild.create({
				data: {
					archive: v3.log_messages,
					blocklist: v3.blacklist.roles,
					closeButton: v3.close_button,
					createdAt: v3.createdAt, // createdAt is built-in to Sequelize so does not use the same casing as the other fields
					errorColour: v3.error_colour,
					footer: v3.footer,
					id: v3.id,
					locale: v3.locale,
					primaryColour: v3.colour,
					successColour: v3.success_colour,
				},
			});
		} catch (error) {
			console.log(colours.redBright(error));
		}
	}
});

const categoryMap = new Map(); // v3:v4

sequelize.models.Category.findAll().then(async categories => {
	for (const v3 of categories) {
		console.log(`Migrating category ${v3.id}...`);
		try {
			const v4 = await prisma.category.create({
				data: {
					channelName: v3.name_format,
					claiming: v3.claiming,
					createdAt: v3.createdAt,
					description: 'Please edit your category description',
					discordCategory: v3.id,
					emoji: '🎫',
					enableFeedback: !!v3.survey,
					guild: { connect: { id: v3.guild } },
					image: v3.image,
					memberLimit: v3.max_per_member,
					name: v3.name,
					openingMessage: v3.opening_message,
					pingRoles: v3.ping,
					requireTopic: v3.require_topic,
					staffRoles: v3.roles,
				},
			});
			categoryMap.set(v3.id, v4.id);
		} catch (error) {
			console.log(colours.redBright(error));
		}
	}
});

sequelize.models.Ticket.findAll().then(async tickets => {
	for (const v3 of tickets) {
		console.log(`Migrating ticket ${v3.id}...`);

		try {

			await prisma.ticket.create({
				data: {
					archivedChannels: {
						createMany: (await sequelize.models.ChannelEntity.findAll({ where: { ticket: v3.id } }))
							.map(v3channel => ({
								channelId: v3channel.channel,
								createdAt: v3channel.createdAt,
								name: v3channel.name,
							})),
					},
					category: { connect: { id: categoryMap.get(v3.category) } },
					claimedBy: v3.claimed_by && {
						connectOrCreate: {
							create: { id: v3.claimed_by },
							where: { id: v3.claimed_by },
						},
					},
					closedBy: v3.closed_by && {
						connectOrCreate: {
							create: { id: v3.closed_by },
							where: { id: v3.closed_by },
						},
					},
					closedReason: v3.closed_reason,
					createdAt: v3.createdAt,
					createdBy: v3.creator && {
						connectOrCreate: {
							create: { id: v3.creator },
							where: { id: v3.creator },
						},
					},
					firstResponseAt: v3.first_response,
					guild: { connect: { id: v3.guild } },
					id: v3.id,
					lastMessageAt: v3.last_message,
					number: v3.number,
					open: v3.open,
					openingMessageId: v3.opening_message,
					pinnedMessageIds: v3.pinned_messages,
					topic: v3.topic,
				},
			});

			const roles = await sequelize.models.RoleEntity.findAll({ where: { ticket: v3.id } });
			for (const v3role of roles) {
				await prisma.archivedRole.create({
					data: {
						colour: v3role.colour,
						createdAt: v3role.createdAt,
						name: v3role.name,
						roleId: v3role.role,
						ticket: { connect: { id: v3.id } },
					},
				});
			}

			const users = await sequelize.models.UserEntity.findAll({ where: { ticket: v3.id } });
			for (const v3user of users) {
				await prisma.archivedRole.create({
					data: {
						avatar: v3user.avatar,
						bot: v3user.bot,
						createdAt: v3user.createdAt,
						discriminator: v3user.discriminator,
						displayName: v3user.display_name,
						name: v3user.name,
						role: {
							connect: {
								roleId: v3user.role,
								ticketId: v3.id,
							},
						},
						ticket: { connect: { id: v3.id } },
						userId: v3user.user,
					},
				});
			}

			const messages = await sequelize.models.Message.findAll({ where: { ticket: v3.id } });
			for (const v3message of messages) {
				await prisma.archivedRole.create({
					data: {
						author: {
							connect: {
								authorId: v3message.author,
								ticketId: v3.id,
							},
						},
						content: v3message.data,
						createdAt: v3message.createdAt,
						deleted: v3message.deleted,
						edited: v3message.edited,
						id: v3message.id,
					},
				});
			}


		} catch (error) {
			console.log(colours.redBright(error));
		}
	}
});