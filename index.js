'use strict';

const fs = require('fs');
const util = require('util');
const _ = require('lodash');
const requestPromise = require('request-promise-native');
const logger = require('winston');
const kue = require('kue');
const QueueHelper = require('./queueHelper');

const queue = kue.createQueue();

const challengeURL = 'https://api.topcoder.com/v3/challenges';
const challengeListFile = 'prod_challenges.json';
const resultsFolderFull = './challenges-full';
const resultsFolderPartial = './challenges-partial';

const qh = new QueueHelper(queue, {attempts: 3, delay: 1000}, (job, done) => {
  const challenge = job.data;
  logger.info(`calling for data for ${challenge.id}`);

  const options = {
    uri: `${challengeURL}/${challenge.id}`,
    json: true
  };

  requestPromise(options).then((challengeDetail) => {
    let resultsFolder = resultsFolderFull;
    // console.log(util.inspect(challengeDetail, {showHidden: false, depth: null}));
    if (challengeDetail.result && challengeDetail.success && challengeDetail.status === '200') {
      logger.info(`saving challenge ${challenge.id} details to file`);
    } else {
      logger.info(`saving challenge ${challenge.id} without details to file`);
      resultsFolder = resultsFolderPartial;
      logger.debug(challengeDetail);
      done();
    }

    fs.writeFile(`${resultsFolder}/${challenge.id}.json`, _.merge(challenge, challengeDetail), (writeErr) => {
      if (writeErr) {
        logger.error(writeErr);
      }

      logger.info(`saved challenge ${challenge.id} to file`);
      done();
    });
  }).catch((callErr) => {
    console.log(util.inspect(callErr, {showHidden: false, depth: null}));
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
    if (challenge.status === 'Deleted') {
      logger.info(`skipping challenge ${challenge.id} as it's deleted`);
    } else {
      logger.info(`loading challenge ${challenge.id} to queue`);
      qh.enqueue(challenge, (queueingErr, job) => {
        if (queueingErr) {
          logger.error(queueingErr);
          return;
        }

        const ch = job.data;
        logger.info(`job(${job.id}) / chalenge id: ${ch.id}`);
      });
    }
  });

  return;
});
