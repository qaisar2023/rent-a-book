const express = require("express");
const session = require('express-session');
const MongoStore = require('connect-mongo'); // TO PRESERVE SESSION DATA 
const app = express();
const HTTP_PORT = process.env.PORT || 8080;

app.set("view engine", "ejs");

app.use(express.urlencoded({ extended: true }));

const mongoose = require("mongoose");

const CONNECTION_STRING = 'mongodb://john:john@ac-feolfzv-shard-00-00.rd3cdiv.mongodb.net:27017,ac-feolfzv-shard-00-01.rd3cdiv.mongodb.net:27017,ac-feolfzv-shard-00-02.rd3cdiv.mongodb.net:27017/?ssl=true&replicaSet=atlas-bvsbpj-shard-0&authSource=admin&retryWrites=true&w=majority'; // 'mongodb://127.0.0.1:27017/book-rent';
mongoose.connect(CONNECTION_STRING);


app.use(session({
  secret: 'library-app',
  resave: false,
  saveUninitialized: false,
  /* WHEN WE SAVE CHANGES IN CODE, SERVER RESTARTS, SESSION DATA IS LOST */
  /* THATS WHY WE ARE USING MongoStore SO WE DONT HAVE TO LOGIN AGAIN AND AGAIN WHILE TESTING CODE */
  store: MongoStore.create({
    mongoUrl: CONNECTION_STRING,
    touchAfter: 24 * 3600 // WE WANT TO STORE SESSION FOR 24 HOURS
  })
}));

const db = mongoose.connection;

db.on('error', console.error.bind(console, 'Connection error:'));
db.once('open', () => {
  console.log('Connected to the database');
});

/* BOOK SCHEMA */
const Schema = mongoose.Schema;
const bookSchema = new Schema({
  title: String,
  author: String,
  image: String,
  borrowed_by: String,
});
const Book = mongoose.model("books", bookSchema);

/* USER SCHEMA */
const userSchema = new Schema({
  name: String,
  library_card_number: String
});
const User = mongoose.model("users", userSchema);

app.use(express.static('public'));

/* HOME PAGE */
app.get('/', async (req, res) => {

  Book.find({})
  .then((books) => {
    res.render('home', { 
      books, 
      session: req.session 
    });
  })
  .catch((error) => {
    return res.status(400).send({ error });
  });
  
});

/* LOGIN PAGE */
app.get('/login', (req, res) => {
  res.render('login', {session: req.session});
});

/* HANDLE LOGIN FORM DATA */
app.post('/login', async (req, res) => {
  let library_card_number = req.body.library_card_number;
  let password = req.body.password;

  let user = await User.findOne({ library_card_number }).exec();
  let user_db_password = user ? (user.library_card_number + user.name.charAt(0)) : null;

  if (user == null) {
    req.session.message = 'No user found with this card number!';
    return res.redirect("/login");
  } else if (password != user_db_password) {
    req.session.message = 'In correct password!';
    return res.redirect("/login");
  } else {
    req.session.loggedIn = true;
    req.session.name = user.name;
    req.session.library_card_number = library_card_number;

    res.redirect("/");
  }

});

/* HANDLE BOOK BORROW FUNCTION */
app.get('/book/borrow/:id', async (req, res) => {
  let book_id = req.params.id;
  let book = await Book.findById({ _id: book_id }).exec();

  /* IF LOGGEDIN IS NOT SET MEANS USER IS NOT LOGGED IN SO REDIRECT USER TO LOGIN PAGE */
  if (!req.session.loggedIn) {
    return res.redirect('/login');

    /* IF BOOK IS ALREADY BORROWED - REDIRECT USER TO HOME PAGE WITH MESSAGE */
  } else if (book.borrowed_by != '' && book.borrowed_by != req.session.library_card_number) {
    req.session.message = book.title + ', book is already checked out by user!';
    return res.redirect('/');
  } else {
    book.borrowed_by = req.session.library_card_number;
    await book.save();

    return res.redirect('/');
  }
});

/* HANDLE BOOK RETURN FUNCTION */
app.get('/book/return/:id', async (req, res) => {
  let book_id = req.params.id;
  let book = await Book.findById({ _id: book_id }).exec();

  /* IF LOGGEDIN IS NOT SET MEANS USER IS NOT LOGGED IN SO REDIRECT USER TO LOGIN PAGE */
  if (!req.session.loggedIn) {
    return res.redirect('/login');

    /* IF BOOK IS NOT BORROWED BY LOGGEDIN USER, THAT USER CANNOT RETURN IT */
  }if (book.borrowed_by != req.session.library_card_number) {
    return res.redirect("/");
  } else {
    book.borrowed_by = '';
    await book.save();

    return res.redirect('/');
  }

  
})

/* HANDLE LOGOUT FUNCTION */
app.get('/logout', (req, res) => {
  delete req.session.loggedIn;
  delete req.session.library_card_number;

  res.redirect("/");
})

/* PATH TO POPULATE BOOKS AND USERS COLLECTION */
app.get('/populate', async (req, res) => {
  let books = [
    {
      title: 'Node.js Design Patterns',
      author: 'Mario Casciaro',
      image: 'nodejs-design-pattern.jpg',
      borrowed_by: ''
    },
    {
      title: 'Express.js Guide: The Comprehensive Book on Express.js',
      author: 'Azat Mardan',
      image: 'the-comprehensive-book-on-expressjs.jpg',
      borrowed_by: ''
    },
    {
      title: 'Eloquent JavaScript',
      author: 'Marijn Haverbeke',
      image: 'eloquent-javaacript.jpg',
      borrowed_by: ''
    },
    {
      title: 'MongoDB: The Definitive Guide',
      author: 'Kristina Chodorow',
      image: 'mongodb-the-definitive-guide.jpg',
      borrowed_by: ''
    },
    {
      title: 'HTML and CSS: Design and Build Websites',
      author: 'Jon Duckett',
      image: 'html-and-css-design.jpg',
      borrowed_by: ''
    }
  ];

  let users = [
    {
      name: 'Abbie Lee',
      library_card_number: '0000'
    },
    {
      name: 'David Aziz',
      library_card_number: '0001'
    }
  ]

  // First we have to Check if the books collection is empty - then we save
  try {
    const count = await Book.countDocuments({});
    if (count === 0) {
      await Book.create(books);
    }
  } catch (err) {
    console.error('Error:', err);
  }

  try {
    const count = await User.countDocuments({});
    if (count === 0) {
      await User.create(users);
    }
  } catch (err) {
    console.error('Error:', err);
  }

  res.redirect('/');
});

app.get('/delete', (req, res) => {
  Book.deleteMany({}).then(function(){
    console.log("Data deleted");
  }).catch(function(error){
    console.log(error);
  });
  User.deleteMany({}).then(()=> console.log('Data deleted')).catch(function(error) {
    console.log(error);
  });
  res.redirect('/');
});

const onHttpStart = () => {
  console.log(`Express web server running on port: ${HTTP_PORT}`);
};

app.listen(HTTP_PORT, onHttpStart);