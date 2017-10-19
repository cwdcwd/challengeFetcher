'use strict';

const _ = require('lodash');
const fs = require('fs');
const requestPromise = require('request-promise');
const logger = require('winston');
const kue = require('kue');
const QueueHelper = require('./queueHelper');

const queue = kue.createQueue();
const challengeListFile = 'prod_challenges.json';

const qh = new QueueHelper(queue, {attempts: 5, delay: 1000}, (job, done) => {
  const challenge = job.data;
  logger.info(`calling for data for ${challenge.id}`);
  // call out here
  done();
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
