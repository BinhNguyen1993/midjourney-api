import "dotenv/config";
import { Midjourney } from "../src";

const homeDir = require('os').homedir();
const desktopDir = `${homeDir}/Desktop`;
const fs = require('fs')

interface IQueue<T> {
  enqueue(item: T): void;
  dequeue(): T | undefined;
  size(): number;
}

class Queue<T> implements IQueue<T> {
  private storage: T[] = [];

  constructor(private capacity: number = Infinity) {}

  enqueue(item: T): void {
    if (this.size() === this.capacity) {
      throw Error("Queue has reached max capacity, you cannot add more items");
    }
    this.storage.push(item);
  }
  dequeue(): T | undefined {
    return this.storage.shift();
  }
  size(): number {
    return this.storage.length;
  }
}

const client = new Midjourney({
  ServerId: <string>process.env.SERVER_ID,
  ChannelId: <string>process.env.CHANNEL_ID,
  SalaiToken: <string>process.env.SALAI_TOKEN,
  Debug: true,
  Ws: true,
});

async function main() {

  console.log("Run auto-prompts ....");
  //console.log("testing: >>", process.argv[2], process.argv[3]);

  // client.Close();
}

var _totalPromptRunning = 0;
var _prompQueue = new Queue<string>();
var _newImgPath;
var _newImgName;

async function checkingNewPrompts() {

  console.log("checkingNewPrompts/_totalPromptRunning: " + _totalPromptRunning);

  if (_totalPromptRunning >= Number(<string>process.env.MAX_QUEUE_PROMPT_MJ_ALLOW)) {
    console.log("Queue in full ... _totalPromptRunning" + _totalPromptRunning);
    console.log("_prompQueue Size = " + _prompQueue.size());
    intervalID.refresh();
    return;
  }
  else {
    if (_prompQueue.size() > 0) {
      // lay prompt moi 
      var newPrompt = _prompQueue.dequeue() as string;
      console.log("---------> Run new prompt " + newPrompt);
      _totalPromptRunning++;

      const Imagine = client.Imagine(
        newPrompt,
        (uri: string, progress: string) => {
          console.log("Imagine.loading", uri, "progress", progress);
          if (parseFloat(progress) < 90){
            console.log("PROGRESS = " + progress);
          }else{
            _totalPromptRunning--;
            console.log("_totalPromptRunning" + _totalPromptRunning);
          }
        }
      );
      console.log({ Imagine });
      if (!Imagine) {
        return;
      }
      intervalID.refresh();
    }
    else {
      if (_newImgPath) {
        console.log("Tìm thấy ảnh mới " + _newImgPath);

        // copy image to hosting path
        var savePath = <string>process.env.IMAGE_HOSTING_PATH + "/" + _newImgName;
        var imgHostingURL = <string>process.env.IMAGE_HOSTING_URL + "/" + _newImgName;
        fs.readFile(_newImgPath, function (err, data) {
          if (err) throw err;
          fs.writeFile(savePath, data, async function (err) {
            if (err) throw err;
            console.log('Image copied to hosting path ' + savePath);           

            await client.Connect();
            // get Describe for new image
            const Describe = await client.Describe(
              imgHostingURL
            );
            //console.log(Describe);
            if (!Describe) {
              console.log("failed to describe");
            }
            else{
              console.log(Describe.uri);
              console.log(Describe.descriptions);

              // create new prompt queue
              var num = 0;
              var max = Number(<string>process.env.MAX_PROMPT_PER_IMAGE);
              console.log("Max prompt per image = " + max);
              while (num < max) {
                Describe.descriptions.forEach(des => {
                  var desEdited = des.split("--")[0].replace(/([\u2700-\u27BF]|[\uE000-\uF8FF]|\uD83C[\uDC00-\uDFFF]|\uD83D[\uDC00-\uDFFF]|[\u2011-\u26FF]|\uD83E[\uDD10-\uDDFF])/g, '');
                  var prompt = Describe.uri + " " + desEdited;
                  if ((_newImgPath as string).includes("cover")){
                    console.log("This is a COVER image");
                    prompt += ","  + <string>process.env.COVER_PARAMS;
                  }else{
                    console.log("This is a INTRERIOR image");
                    prompt += ","  + <string>process.env.INTRERIOR_PARAMS;
                  }
                  console.log("Add queue prompt: " + prompt);
                  _prompQueue.enqueue(prompt);
                  num++;
                });
              }
              console.log("New prompt queue count = " + _prompQueue.size() + "/maxPromptPerImage = " + max);              

              var oldPath = _newImgPath
              var newPath = desktopDir + "/MidJourney/done/" + _newImgName;

              fs.rename(oldPath, newPath, function (err) {
                if (err) throw err
                console.log('Successfully renamed - AKA moved!')
              })

              // remove image
              _newImgPath = null;
              _newImgName = null;             
              

              intervalID.refresh();
                     
            }
          });
        });

      }
      else {
        console.log("Hết ảnh ..............");
        // lay hinh anh moi tu thu muc
        await getNextImage();

        intervalID.refresh();
      }
    }
  }
}

const seconds = 10;

const intervalID = setTimeout(() => {
  try{
    checkingNewPrompts();
  }
  catch (e){
    console.log(e);
    checkingNewPrompts();
  }
  
}, seconds * 1000);

async function getNextImage() {
  // list all files in the directory
  var path = desktopDir + "/MidJourney/cover";
  await fs.readdir(path, (err, files) => {
    if (err) {
      throw err
    }
    if (files.length > 0) {
      _newImgPath = path + "/" + files[0];
      _newImgName = files[0];
      return;
    }
  })
  var path2 = desktopDir + "/MidJourney/interior";
  await fs.readdir(path2, (err, files) => {
    if (err) {
      throw err
    }
    if (files.length > 0) {
      _newImgPath = path2 + "/" + files[0];
      _newImgName = files[0];
      return;
    }
  })
}


main().catch((err) => {
  console.log("finished");
  console.error(err);
  process.exit(1);
});