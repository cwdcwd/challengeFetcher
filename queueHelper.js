'use strict';

const defaultJobType = 'challenge';
const defaultDelay = 1000;
const defaultAttempts = 5;

/**
 * QueueHelper - description
 *
 * @param  {type} q queue object
 * @param  {type} options settings object
 */
function QueueHelper(q, options, processor) {
  const self = this;

  self.queue = q;
  self.jobType = options.jobType || defaultJobType;
  self.msDelay = options.delay || defaultDelay;
  self.attempts = options.attempts || defaultAttempts;

  self.queue.process(self.jobType, (job, done) => {
    processor(job, done);
  });
}

QueueHelper.prototype.enqueue = function enqueue(challenge, onSave) {
  const self = this;

  const job = self.queue.create(self.jobType, challenge).delay(self.msDelay).save((err) => {
    onSave(err, job);
  });

  job.attempts(self.attempts).backoff({
    type: 'exponential'
  });
};


module.exports = QueueHelper;
