'use strict';

var Yakuza, Gurkha, Q, _, mailsScraper, cargoAgent, mailsJob, getMailsTask, SCHEMAS, MAX_PAGES;
Yakuza = require('yakuza');
_ = require('lodash');
Gurkha = require('gurkha');
Q = require('q');
SCHEMAS = require('./cargo-scraper.schemas');
MAX_PAGES = 80000;

function composeUrl (host, path) {
  if (_.contains(path, 'http')) {
    return path;
  }

  return 'http://' + host + path;
}

mailsScraper = Yakuza.scraper('mails');

cargoAgent = Yakuza.agent('mails', 'cargoMails')
  .plan([
    'getMails'
  ])
  .routine('all', [
    'getMails'
  ]);

getMailsTask = Yakuza.task('mails', 'cargoMails', 'getMails');

getMailsTask.builder(function (job) {
  return {};
});

getMailsTask.main(function (task, http, params) {
  var optsTemplate, opts, count, gettingPages, page;

  function handleResponse (result) {
    var body, linksParser, links, gettingMails;

    if (page === 0) {
      body = result.body;
    } else {
      body = JSON.parse(result.body).html;
    }
    // console.log(body);

    linksParser = new Gurkha(SCHEMAS.links);

    links = linksParser.parse(body);

    if (!links) {
      task.success('mails retrieved');
      return;
    }

    // console.log(links);

    gettingMails = [];

    _.each(links, function (link) {
      var opts, request;

      opts = optsTemplate.build({
        'url': link
      });

      request = http.get(opts)

      .then(function (result) {
        var body, opts, mail, linkParser, links, about;

        body = result.body;

        try {
          mail = body.match(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i);
        } catch (e) {
          return;
        }

        if (mail === null) {
          linkParser = new Gurkha(SCHEMAS.internalLinks);
          links = linkParser.parse(body);
          // console.log(links);
          about = _.find(links, function (element) {
            var lc = element.toLowerCase();
            return _.contains(lc, 'about') || _.contains(lc, 'info') || _.contains(lc, 'contact');
          });

          // console.log(about);

          if (about) {
            opts = optsTemplate.build({
              'url': composeUrl(result.res.req._headers.host, about)
            });

            return http.get(opts)

            .then(function (result) {
              var body, mail;

              body = result.body;

              try {
                mail = body.match(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i);
              } catch (e) {
                return;
              }

              return mail[0];
            });
          }
        } else {
          return mail[0];
        }
      })

      .then(function (result) {
        var opts, mail;

        if (result) {
          mail = result;

          opts = optsTemplate.build({
            'url': 'http://52.33.130.163//users',
            'data': {
              'user_data': {
                'user': {
                  'email': result,
                  'name': ''
                },
              },
              'country_code': 21
            }
          });

          return http.post(opts)

          .then(function (result) {
            console.log('____________');
            console.log(++count);
            console.log('mail:' + mail);
            console.log(result.body);
            console.log('____________');
          });
        }
      });

      gettingMails.push(request);
    });

    Q.all(gettingMails)

    .then(function (result) {
    })

    .fail(function (reason) {
    }).done();
  }

  count = 0;
  page = 0;
  gettingPages = Q.resolve([]);

  for(page = 0; page < MAX_PAGES; ++page) {
    console.log(page);
    var optsTemplate, opts;

    optsTemplate = http.optionsTemplate();

    if (page === 0) {
      opts = optsTemplate.build({
        'url': 'http://cargocollective.com/gallery'
      });

      gettingPages = gettingPages.then(function (result) {
        http.get(opts)

        .then(handleResponse);
      });
    }

    opts = optsTemplate.build({
      'url': 'http://cargocollective.com/dispatch/tracemark/loadTracemarks',
      'data': {
        'should_paginate': 'true',
        'is_updating': 'true',
        'within_bounds': 'true',
        'preload_distance': '1500',
        'page': page,
        'more_load_handle': '.gallery #moreload',
        'ajax_route': 'tracemark/loadTracemarks',
        'is_ajax': 'true',
        'height_selector': '#column_2',
        'limit': '50',
        'offset': '50'
      }
    });

    gettingPages = gettingPages.then(function (result) {
      http.post(opts)

      .then(handleResponse);
    });
  }

  gettingPages.then(function (result) {
    task.success('mails retrieved');
  });
});

mailsJob = Yakuza.job('mails', 'cargoMails');

mailsJob.on('task:*:fail', function (response) {
  console.log('Task ' + response.task.taskId + ' failed');
  console.log(response.error.stack);
});

mailsJob.on('task:sendMails:success', function (response) {
  console.log(response);
});

mailsJob.routine('all');

mailsJob.run();
