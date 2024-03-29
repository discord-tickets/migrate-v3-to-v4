# migrate-v3-to-v4

A tool to migrate data from version **3.1 to 4.0**.

## Limitations

- This tool only works with version **3.1** of the bot. If you are using an older version, you will need to update to version **3.1** first.
- This tool can't be used to change the database type (e.g. from SQLite to MySQL). This isn't a technical limitation, so you can open an issue if you want this to be supported.
- You need **two** databases.

## Steps

1. Clone this repository

```sh
$ git clone https://github.com/discord-tickets/migrate-v3-to-v4.git
```

2. Copy the Prisma schema for your database (replace `mysql` with `sqlite` or `postgresql` if you're not using MySQL)

```sh
$ cp prisma/mysql.prisma prisma/schema.prisma
```

3. Install dependencies with (P)NPM or Yarn

```sh
$ npm install
```

and one of the following:

```sh
$ npm install sqlite3 # for SQLite
# or
$ npm install mysql2 # for MySQL
# or
$ npm install pg pg-hstore # for PostgreSQL
```

4. Generate the Prisma client and baseline the database

```sh
$ npx prisma db push
```
> **Note**
>
> If you are using MySQL or PostgreSQL, you need to set the `V4_DB` environment variable to the connection string of your new database.
> 
> **Linux example:**
> ```sh
> $ V4_DB=mysql://... npx prisma db push
> ```
> **Windows example:**
> ```bash
> $ set V4_DB=mysql://...
> $ npx prisma db push
> ```

5. Run the migrator

```sh
$ node . <options>
```

## Usage

```
Usage: migrate-v3-to-v4 [options]

Options:
  -s, --sqlite <file>         v3 sqlite database file
  --v3 <url>                  v3 database connection string
  --v4 <url>                  v4 database connection string
  -p, --prefix <prefix>       v3 database table prefix (default: "dsctickets_")
  -k, --key <encryption key>  v3 encryption key (default: null)
  -h, --help                  display help for command
```

#### SQLite

```sh
$ node . --sqlite <path to v3 database>
```

#### MySQL

```sh
$ node . --v3 mysql://... --v4 mysql://... -k <encryption key>
```

#### PostgreSQL

```sh
$ node . --v3 postgresql://... --v4 postgresql://... -k <encryption key>
```
