# Taskade
Taskade MERN clone 


To start server:
npm run start (node)
npm run dev (nodemon)


SignUp 
mutation signUp ($email: String!, $password: String!, $name: String!) {
  signUp(input: {
    email: $email,
    password: $password,
    name: $name
  }) {
    token
    user {
      id
      name
    }
  }
}

SignIn
mutation signIn ($email: String!, $password: String!) {
  signIn(input: {
    email: $email,
    password: $password,
  }) {
    token
    user {
      id
      name
      email
    }
  }
}

Variables:
{
  "email": "tang3@pdx.edu",
  "password": "admin",
}