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

// A schema is a collection of type definitions (hence "typeDefs")
// that together define the "shape" of queries that are executed against
// your data.
const typeDefs = gql`
  type Query {
    myTaskLists: [TaskList!]!
    getTaskList(id: ID!): TaskList
  }

  type Mutation {
    signUp(input: SignUpInput): AuthUser!
    signIn(input: SignInInput): AuthUser!
    createTaskList(title: String!): TaskList!
    updateTaskList(id: ID!, title: String!): TaskList!
    deleteTaskList(id: ID!): Boolean!
    addUserToTaskList(taskListId: ID!, userId: ID!): TaskList
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
      return taskLists;
    },
    getTaskList: async (_, { id }, { db, user }) => {
      if (!user) {
        throw new Error("Authentication Error. Please sign in");
      }
      return await db.collection("TaskList").findOne({ _id: ObjectId(id) });
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
      const savedTaskList = await db
        .collection("TaskList")
        .findOne({ _id: result.insertedId });
      return savedTaskList;
    },
    updateTaskList: async (_, { id, title }, { db, user }) => {
      if (!user) {
        throw new Error("Authentication Error. Please sign in");
      }

      const result = await db.collection("TaskList").updateOne(
        {
          _id: ObjectId(id),
        },
        {
          $set: {
            title,
          },
        }
      );
      // simplified version of similar code from createTaskList
      return await db.collection("TaskList").findOne({ _id: ObjectId(id) });
    },
    deleteTaskList: async (_, { id }, { db, user }) => {
      if (!user) {
        throw new Error("Authentication Error. Please sign in");
      }
      // TODO only collaborators of this task list should be able to delete
      const result = await db
        .collection("TaskList")
        .deleteOne({ _id: ObjectId(id) });
      return result.deletedCount == 0 ? false : true;
    },
    addUserToTaskList: async (_, { taskListId, userId }, { db, user }) => {
      if (!user) {
        throw new Error("Authentication Error. Please sign in");
      }
      const taskList = await db.collection('TaskList').findOne({ _id: ObjectId(taskListId) });
      if (!taskList) {
        return null;
      }
      if (taskList.userIds.find((dbId) => dbId.toString() === userId.toString())) {
        return taskList;
      }
      // TODO only collaborators of this task list should be able to add new users
      const result = await db
        .collection("TaskList")
        .updateOne(
          { _id: ObjectId(taskListId) },
          { $push: { userIds: ObjectId(userId) } }
        );

      return await db.collection("TaskList").findOne({ _id: ObjectId(taskListId) });
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
