'use strict';

function Article (rawDataObj) {
  Object.keys(rawDataObj).forEach(key => {
    this[key] = rawDataObj[key]
  }, this);
}

Article.all = [];

Article.prototype.toHtml = function() {
  var template = Handlebars.compile($('#article-template').text());

  this.daysAgo = parseInt((new Date() - new Date(this.published_on))/60/60/24/1000);
  this.publishStatus = this.published_on ? `published ${this.daysAgo} days ago` : '(draft)';
  this.body = marked(this.body);

  return template(this);
};

Article.loadAll = articleData => {
  articleData.sort((a,b) => (new Date(b.published_on)) - (new Date(a.published_on)))

  articleData.forEach(articleObject => Article.all.push(new Article(articleObject)))
};

Article.fetchAll = callback => {
  $.get('/articles')
    .then(results => {
      Article.loadAll(results);
      callback();
    }
  )
};

Article.truncateTable = callback => {
  $.ajax({
    url: '/articles',
    method: 'DELETE',
  })
  .then(data => {
    console.log(data);
    if (callback) callback();
  });
};

Article.prototype.insertRecord = function(callback) {
  $.post('/articles', {author: this.author, author_url: this.author_url, body: this.body, category: this.category, published_on: this.published_on, title: this.title})
  .then(data => {
    console.log(data);
    if (callback) callback();
  })
};

Article.prototype.deleteRecord = function(callback) {
  $.ajax({
    url: `/articles/${this.article_id}`,
    method: 'DELETE'
  })
  .then(data => {
    console.log(data);
    if (callback) callback();
  });
};

Article.prototype.updateRecord = function(callback) {
  $.ajax({
    url: `/articles/${this.article_id}`,
    method: 'PUT',
    data: {
      author: this.author,
      author_url: this.author_url,
      body: this.body,
      category: this.category,
      published_on: this.published_on,
      title: this.title,
      author_id: this.author_id
    }
  })
  .then(data => {
    console.log(data);
    if (callback) callback();
  });
};
