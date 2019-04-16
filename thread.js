const cp = require('child_process');
const {
  Worker,
  workerData,
  parentPort,
  MessagePort,
  MessageChannel,
  isMainThread
// eslint-disable-next-line import/no-unresolved
} = require('worker_threads');

const helpParse = require('help-parser');

/**
   * @function
   * @param {String} command
   * @returns {Promise<Object>}
   */
function cmdParser(command) {
  return new Promise((resolve, reject) => {
    const cmd = `${command} --help`;
    cp.exec(cmd, (err, stout, stin) => {
      if (err) {
        reject(err);
      }
      const helpObj = helpParse(stout, command);
      resolve(helpObj);
    });
  });
}

