// from: https://www.apollographql.com/docs/apollo-server/getting-started/

const { ApolloServer, gql } = require('apollo-server');
const { MongoClient } = require('mongodb');
const dotenv = require('dotenv');
dotenv.config();

const { DB_URI, DB_NAME } = process.env;    // pull from .env file


const books = [
    {
        title: 'The Awakening',
        author: 'Kate Chopin',
    },
    {
        title: 'City of Glass',
        author: 'Paul Auster',
    },
];


// A schema is a collection of type definitions (hence "typeDefs")
// that together define the "shape" of queries that are executed against
// your data.
const typeDefs = gql`
  # Comments in GraphQL strings (such as this one) start with the hash (#) symbol.

  # The "Query" type is special: it lists all of the available queries that
  # clients can execute, along with the return type for each. In this
  # case, the "books" query returns an array of zero or more Books (defined above).
  type Query {
    books: [Book]
  }

  # This "Book" type defines the queryable fields for every book in our data source.
  type Book {
    title: String
    author: String
  }


`;


// Resolvers define the technique for fetching the types defined in the
// schema. This resolver retrieves books from the "books" array above.
const resolvers = {
    Query: {
        books: () => { 
            return books 
        },
    },
};

const start = async () => {
    // MongoDB driver code. Connect to MongoDB
    const client = new MongoClient(DB_URI, { useNewUrlParser: true, useUnifiedTopology: true });
    await client.connect();
    const db = client.db(DB_NAME);

    const context = {
        db,
    }

    // The ApolloServer constructor requires two parameters: your schema
    // definition and your set of resolvers.
    const server = new ApolloServer({ typeDefs, resolvers, context });

    // The `listen` method launches a web server.
    server.listen().then(({ url }) => {
        console.log(`🚀  Server ready at ${url}`);
    });
}

start();



