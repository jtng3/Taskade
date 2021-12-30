// from: https://www.apollographql.com/docs/apollo-server/getting-started/

const { ApolloServer, gql } = require("apollo-server");
const { MongoClient, ObjectId } = require("mongodb");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const dotenv = require("dotenv");
dotenv.config();

const { DB_URI, DB_NAME, JWT_SECRET } = process.env; // pull from .env file

const getToken = (user) =>
  jwt.sign({ id: user._id }, JWT_SECRET, { expiresIn: "30  days" });

const getUserFromToken = async (token, db) => {
  if (!token) {
    return null;
  }
  const tokenData = jwt.verify(token, JWT_SECRET);
  // console.log({ tokenData });
  if (!tokenData?.id) {
    return null;
  }
  const user = await db
    .collection("Users")
    .findOne({ _id: ObjectId(tokenData.id) });

  return user;
};

const books = [
  {
    title: "The Awakening",
    author: "Kate Chopin",
  },
  {
    title: "City of Glass",
    author: "Paul Auster",
  },
];

// A schema is a collection of type definitions (hence "typeDefs")
// that together define the "shape" of queries that are executed against
// your data.
const typeDefs = gql`
  type Query {
    myTaskLists: [TaskList!]!
  }

  type Mutation {
    signUp(input: SignUpInput): AuthUser!
    signIn(input: SignInInput): AuthUser!
    createTaskList(title: String!): TaskList!
  }

  input SignUpInput {
    email: String!
    password: String!
    name: String!
    avatar: String
  }

  input SignInInput {
    email: String!
    password: String!
  }

  type AuthUser {
    user: User!
    token: String!
  }

  type User {
    id: ID!
    name: String!
    email: String!
    avatar: String
  }

  type TaskList {
    id: ID!
    createdAt: String!
    title: String!
    progress: Float!

    users: [User!]!
    todos: [Todo!]!
  }

  type Todo {
    id: ID!
    content: String!
    isComplete: Boolean!

    taskListId: ID!
    taskList: TaskList!
  }
`;

// Resolvers define the technique for fetching the types defined in the
// schema. This resolver retrieves books from the "books" array above.
const resolvers = {
  Query: {
    myTaskLists: async (_, __, { db, user }) => {
      if (!user) {
        throw new Error("Authentication Error. Please sign in");
      }
      const taskLists = await db
        .collection("TaskList")
        .find({ userIds: user._id })
        .toArray();
      console.log("TASKLIST\n");
      console.table(taskLists);
      return taskLists;
    },
  },
  Mutation: {
    signUp: async (_, { input }, { db }) => {
      // console.log(input.email);
      const hashedPassword = bcrypt.hashSync(input.password);
      const user = {
        ...input,
        password: hashedPassword,
      };
      // save to database
      const result = await db.collection("Users").insertOne(user);
      const newUser = await db
        .collection("Users")
        .findOne({ _id: result.insertedId });
      return {
        user: newUser,
        token: getToken(newUser),
      };
    },

    signIn: async (_, { input }, { db }) => {
      const user = await db.collection("Users").findOne({ email: input.email });
      if (!user) {
        throw new Error("Invalid credentials!");
      }
      // check if password is correct
      const isPasswordCorrect = bcrypt.compareSync(
        input.password,
        user.password
      );
      if (!isPasswordCorrect) {
        throw new Error("Invalid credentials!");
      }
      return {
        user,
        token: getToken(user),
      };
    },

    createTaskList: async (_, { title }, { db, user }) => {
      if (!user) {
        throw new Error("Authentication Error. Please sign in");
      }
      const newTaskList = {
        title,
        createdAt: new Date().toISOString(),
        userIds: [user._id],
      };
      const result = await db.collection("TaskList").insertOne(newTaskList);
      console.log("RESULT: " + JSON.stringify(result.insertedId));
      const savedTaskList = await db
        .collection("TaskList")
        .findOne({ _id: result.insertedId });
      console.log("SAVEDTASKLIST: " + JSON.stringify(savedTaskList));
      console.table(savedTaskList);
      return savedTaskList;
    },
  },
  User: {
    // Incase database has either _id or id (wow!!)
    id: ({ _id, id }) => _id || id,
  },

  TaskList: {
    // Incase database has either _id or id (wow!!)
    id: ({ _id, id }) => _id || id,
    progress: () => 0,
    users: ({ userIds }, _, { db }) =>
      Promise.all(
        userIds.map((userId) => db.collection("Users").findOne({ _id: userId }))
      ),
  },
};

const start = async () => {
  // MongoDB driver code. Connect to MongoDB
  const client = new MongoClient(DB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  });
  await client.connect();
  const db = client.db(DB_NAME);

  // The ApolloServer constructor requires two parameters: your schema
  // definition and your set of resolvers.
  const server = new ApolloServer({
    typeDefs,
    resolvers,
    context: async ({ req }) => {
      //      console.log("req.headers.authorization: " + req.headers.authorization);
      const user = await getUserFromToken(req.headers.authorization, db);
      // console.log("user in server: " + JSON.stringify(user));
      return {
        db,
        user,
      };
    },
  });

  // The `listen` method launches a web server.
  server.listen().then(({ url }) => {
    console.log(`🚀  Server ready at ${url}`);
  });
};

start();
