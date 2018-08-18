'use strict';

const pg = require('pg');
const fs = require('fs');
const express = require('express');
const PORT = process.env.PORT || 3000;
const app = express();

const conString = 'postgres://localhost:5432/lab09';
const client = new pg.Client(conString);
client.connect();
client.on('error', error => {
  console.error(error);
});

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('./public'));

// REVIEWED: These are routes for requesting HTML resources.
app.get('/new-article', (request, response) => {
  response.sendFile('new.html', { root: './public' });
});

// REVIEWED: These are routes for making API calls to enact CRUD operations on our database.
app.get('/articles', (request, response) => {
  client.query(`
    SELECT authors.author_id, authors.author, authors.author_url, articles.title, articles.category, articles.published_on, articles.body, articles.article_id
    FROM articles
    INNER JOIN authors
    ON articles.author_id = authors.author_id;
  `)
    .then(result => {
      response.send(result.rows);
    })
    .catch(err => {
      console.error(err)
      response.status(500).send(err);
    });
});

app.post('/articles', (request, response) => {
  let SQL = `
    INSERT INTO authors(author, author_url)
    VALUES($1,$2) 
    ON CONFLICT DO NOTHING;
    `;
  let values = [
    request.body.author,
    request.body.author_url
  ];

  client.query(SQL, values,
    function(err) {
      if (err) {
        console.error(err);
        // REVIEWED: Early return here prevents queryTwo from running if there's an error
        return response.status(500).send(err);
      }
      // REVIEWED: This is our second query, to be executed when this first query is complete.
      queryTwo();
    }
  )

  function queryTwo() {
    let SQL = `
    SELECT author_id 
    FROM authors
    WHERE author=$1
    `;
    let values = [request.body.author];
    client.query(SQL, values,
      function(err, result) {
        if (err) {
          console.error(err);
          // REVIEWED: Early return here prevents queryThree from running if there's an error
          return response.status(500).send(err);
        }
        // REVIEWED: This is our third query, to be executed when the second is complete. We are also passing the author_id into our third query.
        queryThree(result.rows[0].author_id);
      }
    )
  }

  function queryThree(author_id) {
    let SQL = `
      INSERT INTO 
      articles(author_id, title, category, published_on, body) 
      VALUES($1, $2, $3, $4, $5)
      `;
    let values = [
      author_id,
      request.body.title,
      request.body.category,
      request.body.published_on,
      request.body.body
    ];
    client.query(SQL, values,
      function(err) {
        if (err) {
          console.error(err);
          // REVIEWED: Early return here prevents sending again if there's an error
          return response.status(500).send(err);
        }
        response.send('insert complete');
      }
    );
  }
});

app.put('/articles/:id', function(request, response) {
  let SQL = `
    UPDATE authors 
    SET author=$1, author_url=$2
    WHERE author_id=$3
  `;
  let values = [
    request.body.author,
    request.body.author_url,
    request.body.author_id
  ];
  client.query(SQL, values)
    .then(() => {
      let SQL = `
        UPDATE articles
        SET title=$1, category=$2, published_on=$3, body=$4
        WHERE author_id=$5
      `;
      let values = [
        request.body.title,
        request.body.category,
        request.body.published_on,
        request.body.body,
        request.body.author_id
      ];
      return client.query(SQL, values);
    })
    .then(() => {
      response.send('Update complete');
    })
    .catch(err => {
      console.error(err);
      response.status(500).send(err);
    })
});

app.delete('/articles/:id', (request, response) => {
  let SQL = `DELETE FROM articles WHERE article_id=$1;`;
  let values = [request.params.id];
  client.query(SQL, values)
    .then(() => {
      response.send('Delete complete');
    })
    .catch(err => {
      console.error(err)
      response.status(500).send(err);
    });
});

app.delete('/articles', (request, response) => {
  let SQL = 'DELETE FROM articles';
  client.query(SQL)
    .then(() => {
      response.send('Delete complete');
    })
    .catch(err => {
      console.error(err)
      response.status(500).send(err);
    });
});

// REVIEWED: This calls the loadDB() function, defined below.
loadDB();

app.listen(PORT, () => {
  console.log(`Server started on port ${PORT}!`);
});


//////// ** DATABASE LOADERS ** ////////
////////////////////////////////////////

// REVIEWED: This helper function will load authors into the DB if the DB is empty.
function loadAuthors() {
  fs.readFile('./public/data/hackerIpsum.json', 'utf8', (err, fd) => {
    JSON.parse(fd).forEach(ele => {
      let SQL = 'INSERT INTO authors(author, author_url) VALUES($1, $2) ON CONFLICT DO NOTHING';
      let values = [ele.author, ele.author_url];
      client.query(SQL, values);
    })
  })
}

// REVIEWED: This helper function will load articles into the DB if the DB is empty.
function loadArticles() {
  let SQL = 'SELECT COUNT(*) FROM articles';
  client.query(SQL)
    .then(result => {
      if (!parseInt(result.rows[0].count)) {
        fs.readFile('./public/data/hackerIpsum.json', 'utf8', (err, fd) => {
          JSON.parse(fd).forEach(ele => {
            let SQL = `
              INSERT INTO articles(author_id, title, category, published_on, body)
              SELECT author_id, $1, $2, $3, $4
              FROM authors
              WHERE author=$5;
            `;
            let values = [ele.title, ele.category, ele.published_on, ele.body, ele.author];
            client.query(SQL, values)
          })
        })
      }
    })
}

// REVIEWED: Below are two queries, wrapped in the loadDB() function, which create separate tables in our DB, and create a relationship between the authors and articles tables.
// THEN they load their respective data from our JSON file.
function loadDB() {
  client.query(`
    CREATE TABLE IF NOT EXISTS
    authors (
      author_id SERIAL PRIMARY KEY,
      author VARCHAR(255) UNIQUE NOT NULL,
      author_url VARCHAR (255)
    );`)
    .then(data => {
      loadAuthors(data);
    })
    .catch(err => {
      console.error(err)
    });

  client.query(`
    CREATE TABLE IF NOT EXISTS
    articles (
      article_id SERIAL PRIMARY KEY,
      author_id INTEGER NOT NULL REFERENCES authors(author_id),
      title VARCHAR(255) NOT NULL,
      category VARCHAR(20),
      published_on DATE,
      body TEXT NOT NULL
    );`)
    .then(data => {
      loadArticles(data);
    })
    .catch(err => {
      console.error(err)
    });
}
