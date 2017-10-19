'use strict';

const fs = require('fs');
const _ = require('lodash');
const requestPromise = require('request-promise-native');
const logger = require('winston');
const kue = require('kue');
const QueueHelper = require('./queueHelper');

const queue = kue.createQueue();

const challengeURL = 'https://api.topcoder.com/v3/challenges';
const challengeListFile = 'prod_challenges.json';
const resultsFolder = 'challenges';

const qh = new QueueHelper(queue, {attempts: 5, delay: 1000}, (job, done) => {
  const challenge = job.data;
  logger.info(`calling for data for ${challenge.id}`);

  const options = {
    uri: `${challengeURL}/${challenge.id}`,
    json: true
  };

  requestPromise(options).then((challengeDetail) => {

    fs.writeFile(`./${resultsFolder}/${challenge.id}.json`, _.merge(challenge, challengeDetail), (writeErr) => {
      if (writeErr) {
        logger.error(writeErr);
      }

      done();
    });
  }).catch((callErr) => {
    logger.error(callErr);
    done();
  });
});


logger.info(`reading in file: ${challengeListFile}`);

fs.readFile(challengeListFile, (err, data) => {
  if (err) {
    logger.error(err);
    return;
  }

  logger.info('parsing JSON from file');
  const challengeList = JSON.parse(data);
  logger.info(`loading ${challengeList.length} challenges to queue`);
  _.forEach(challengeList, (challenge) => {
    qh.enqueue(challenge, (queueingErr, job) => {
      if (queueingErr) {
        logger.error(queueingErr);
        return;
      }

      const ch = job.data;
      logger.info(`job(${job.id}) / chalenge id: ${ch.id}`);
    });
  });

  return;
});
