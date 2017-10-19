'use strict';

const fs = require('fs');
const util = require('util');
const _ = require('lodash');
const requestPromise = require('request-promise-native');
const logger = require('winston');
const kue = require('kue');
const QueueHelper = require('./queueHelper');

const queue = kue.createQueue();

const attempts = 3;
const delay = 500;
const challengeURL = 'https://api.topcoder.com/v3/challenges';
const challengeListFile = 'prod_challenges.json';
const resultsFolderFull = './challenges/full';
const resultsFolderPartial = './challenges/partial';
const resultsFolderError = './challenges/error';
const resultsFolderDeleted = './challenges/deleted';


function saveFile(filename, challenge, cb) {
  fs.writeFile(filename, JSON.stringify(challenge), (writeErr) => {
    if (writeErr) {
      logger.error(writeErr);
    }

    logger.info(`saved challenge ${challenge.id} to file`);
    cb();
  });
}

const qh = new QueueHelper(queue, {attempts, delay}, (job, done) => {
  let challenge = job.data;
  logger.info(`calling for data for ${challenge.id}`);

  const options = {
    uri: `${challengeURL}/${challenge.id}`,
    json: true
  };

  requestPromise(options).then((challengeDetail) => {
    let resultsFolder = resultsFolderFull;
    // console.log(util.inspect(challengeDetail, {showHidden: false, depth: null}));
    if (challengeDetail.result && challengeDetail.result.content && challengeDetail.success && challengeDetail.status === '200') { // CWD-- so ridic...
      logger.info(`saving challenge ${challenge.id} details to file`);
      challenge = _.merge(challenge, challengeDetail.result.content); // CWD-- merge the details into challenge
    } else {
      logger.info(`saving challenge ${challenge.id} without details to file`);
      resultsFolder = resultsFolderPartial;
      logger.debug(challengeDetail);
      done();
    }

    saveFile(`${resultsFolder}/${challenge.id}.json`, challenge, done);
  }).catch((callErr) => {
    // console.log(util.inspect(callErr, {showHidden: false, depth: null}));
    logger.error(callErr);
    saveFile(`${resultsFolderError}/${challenge.id}.json`, challenge, done);
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
      saveFile(`${resultsFolderDeleted}/${challenge.id}.json`, challenge, _.noop);
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
