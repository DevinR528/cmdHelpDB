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

const fs = require('fs');
const { Writable, Transform } = require('stream');

const helpParser = require('help-parser');

class TPipe extends Transform {
  /**
   * Creates an instance of CommandPipe.
   * @param  {Array} cmds
   * @param  {Object} opts
   * @memberof CommandPipe
   */
  constructor(cmds, opts) {
    super(opts);

    this.cmds = Array.from(new Set(cmds));
    this.cmdIdx = 0;
    this.helpArr = [];

    this.buffer = '';
  }

  _transform(chunk, enc, cb) {
    const help = chunk.toString();
    // end of help symbol
    if (help.includes('EOH00')) {
      this.buffer += help.replace('EOH00\n', '');
      const cmd = this.cmds[this.cmdIdx];
      const helpObj = helpParser(this.buffer, cmd)
      this.helpArr.push(helpObj);

      this.cmdIdx++;
      if (this.cmdIdx === this.cmds.length) {
        this.emit('done', this.helpArr);
      } else {
        this.buffer = '';
        this.emit('ready', this.cmdIdx);
      }
    } else {
      this.buffer += help;
    }
    cb();
  }
}

class CommandPipe extends Writable {
  /**
   * Creates an instance of CommandPipe.
   * @param  {Array} cmds
   * @param  {Object} opts
   * @memberof CommandPipe
   */
  constructor(cmds, opts) {
    super(opts);

    this.cmds = Array.from(new Set(cmds));
    this.cmdIdx = 0;
    this.helpArr = [];

    this.buffer = '';
  }

  _write(chunk, enc, cb) {
    const help = chunk.toString();
    // end of help symbol
    if (help.includes('EOH00')) {
      this.buffer += help.replace('EOH00\n', '');
      const cmd = this.cmds[this.cmdIdx];
      this.helpArr.push(helpParser(this.buffer, cmd));

      this.cmdIdx++;
      if (this.cmdIdx === this.cmds.length) {
        this.emit('done', this.helpArr);
      } else {
        this.buffer = '';
        this.emit('ready', this.cmdIdx);
      }
    } else {
      this.buffer += help;
    }
    cb();
  }
}

function run(location) {
  return new Promise((resolve, reject) => {
    const text = fs.readFileSync(location, { encoding: 'utf8' });
    const cmdArr = text.split('\n');
    console.log(cmdArr.length);
    const cmdPipe = new CommandPipe(cmdArr);

    // re route stderr to stdout to get a few more "bad commands"
    const stdioOpts = {
      stdio: [
        'pipe', // Use parent's stdin for child
        process.stdout, // Pipe child's stdout to parent
        process.stdout // Direct child's stderr to a file
      ]
    };
    const child = cp.spawn('bash');

    child.stdin.setEncoding('utf8');
    child.stdout.setEncoding('utf8');

    // this is the driving
    // try dev/null try ref or pause or resume in class
    // check getting stderr to stdout for parsing that
    child.stdout.pipe(cmdPipe);

    child.on('error', (err) => {
      console.log(err);
      reject(err);
    });

    child.stdin.on('error', (err) => {
      if (err.code === 'EPIPE') {
        console.log('epipe');
        resolve(cmdPipe.helpArr);
      }
    });

    child.stdout.on('error', (err) => {
      console.log(`child.stdout: ${err}`);
    });

    child.stderr.on('data', (data) => {
      // console.log(child.stdio[2]);
      // child.stdout.pause()
      const chunk = data.toString();
      child.stdout.push(`${chunk}EOH00\n`);
    });

    cmdPipe.on('error', (err) => {
      console.log(`cmdPipe: ${err}`);
      reject(err);
    });

    cmdPipe.on('ready', (idx) => {
    //                                      end of help symbol
      const cmdEcho = `echo "\`${cmdArr[idx]} --help\`"; echo EOH00\n`;
      child.stdin.write(cmdEcho);
    });

    cmdPipe.on('done', (helps) => {
      child.stdout.unpipe();
      child.kill();
      resolve(helps);
    });

    //                                      end of help symbol
    const cmdEcho = `echo "\`${cmdArr[0]} --help\`";echo EOH00\n`;
    child.stdin.write(cmdEcho);
  });
}

run('./worker/a.txt').then((helps) => {
  // console.log(helps);
  console.log(helps);
}).catch(err => console.log(err));

