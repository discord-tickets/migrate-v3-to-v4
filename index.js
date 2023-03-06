import { program } from 'commander';
import { colours } from 'leeks.js';
import { PrismaClient } from '@prisma/client';
import SQLiteMiddleware from './prisma/sqlite.js';
import { Sequelize } from 'sequelize';
import { readdirSync } from 'fs';

program
	.option('-s, --sqlite <file>', 'v3 sqlite database file')
	.option('--v3 <url>', 'v3 database connection string')
	.option('--v4 <url>', 'v4 database connection string')
	.option('-p, --prefix <prefix>', 'v3 database table prefix', 'dsctickets_');

program.parse(process.argv);
const options = program.opts();

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
const sequelize = type === 'sqlite'
	? new Sequelize({
		dialect: 'sqlite',
		logging: false,
		storage: options.sqlite,
	})
	: new Sequelize(
		options.v3,
		{ logging: false },
	);

const models = readdirSync('./sequelize').filter(filename => filename.endsWith('.model.js'));
for (const model of models) (await import(`./sequelize/${model}`)).default(sequelize);
await sequelize.sync();

// v4
const prisma = new PrismaClient({
	errorFormat: 'pretty',
	log: ['warn', 'error'],
});
if (type === 'sqlite') prisma.$use(SQLiteMiddleware);

// migrate to v4

const guilds = await sequelize.models.Guild.findAll();
for (const v3 of guilds) {
	console.log(`Migrating guild ${v3.id}...`);
	try {
		await prisma.guild.create({
			data: {
				archive: v3.log_messages,
				blocklist: v3.blacklist.roles,
				closeButton: v3.close_button,
				createdAt: v3.createdAt, // createdAt is built-in to Sequelize so does not use the same casing as the other fields
				errorColour: v3.error_colour?.startsWith('#')
					? v3.error_colour
					: v3.error_colour[0] + v3.error_colour.slice(1).toLowerCase(),
				footer: v3.footer,
				id: v3.id,
				locale: v3.locale,
				primaryColour: v3.colour?.startsWith('#')
					? v3.colour
					: v3.colour[0] + v3.colour.slice(1).toLowerCase(),
				successColour: v3.success_colour?.startsWith('#')
					? v3.success_colour
					: v3.success_colour[0] + v3.success_colour.slice(1).toLowerCase(),
			},
		});
	} catch { } // eslint-disable-line no-empty
}

const categoryMap = new Map(); // v3:v4

const categories = await sequelize.models.Category.findAll();
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
	} catch { } // eslint-disable-line no-empty
}

const tickets = await sequelize.models.Ticket.findAll();
for (const v3 of tickets) {
	console.log(`Migrating ticket ${v3.id}...`);
	try {
		await prisma.ticket.create({
			data: {
				archivedChannels: {
					createMany: {
						data: (await sequelize.models.ChannelEntity.findAll({ where: { ticket: v3.id } }))
							.map(v3channel => ({
								channelId: v3channel.channel,
								createdAt: v3channel.createdAt,
								name: v3channel.name,
							})),
					},
				},
				category: { connect: { id: categoryMap.get(v3.category) } },
				claimedBy: (v3.claimed_by && {
					connectOrCreate: {
						create: { id: v3.claimed_by },
						where: { id: v3.claimed_by },
					},
				}) || undefined,
				closedBy: (v3.closed_by && {
					connectOrCreate: {
						create: { id: v3.closed_by },
						where: { id: v3.closed_by },
					},
				}) || undefined,
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
			await prisma.archivedUser.create({
				data: {
					avatar: v3user.avatar,
					bot: v3user.bot,
					createdAt: v3user.createdAt,
					discriminator: v3user.discriminator,
					displayName: v3user.display_name,
					role: {
						connect: {
							ticketId_roleId: {
								roleId: v3user.role,
								ticketId: v3.id,
							},
						},
					},
					ticket: { connect: { id: v3.id } },
					userId: v3user.user,
					username: v3user.name,
				},
			});
		}

		const messages = await sequelize.models.Message.findAll({ where: { ticket: v3.id } });
		for (const v3message of messages) {
			let author = await prisma.archivedUser.findUnique({
				where: {
					ticketId_userId: {
						ticketId: v3.id,
						userId: v3message.author,
					},
				},
			});
			if (!author) {
				author = await prisma.archivedUser.create({
					data: {
						discriminator: '0000',
						displayName: 'Unknown User',
						ticket: { connect: { id: v3.id } },
						userId: v3message.author,
						username: 'Unknown User',
					},
				});
			}

			await prisma.archivedMessage.create({
				data: {
					author: {
						connect: {
							ticketId_userId: {
								ticketId: v3.id,
								userId: v3message.author,
							},
						},
					},
					content: v3message.data,
					createdAt: v3message.createdAt,
					deleted: v3message.deleted,
					edited: v3message.edited,
					id: v3message.id,
					ticket: { connect: { id: v3.id } },
				},
			});
		}

	} catch (error) {
		console.error(colours.red(error));
	}
}