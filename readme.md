# Ushi-Suki-KoSumoso

This project is a a query tool for Azure CosmosDb.

It's purpose is to quickly retrieve data, for a developer, for developing, when developing with Cosmos.

## Works on my machine

Stuff might not work.  
Other stuff might be stupendous.

It should be navigatable by keyboard.

It is an alpha. Your data == your loss.  
With that said - I use the application on production data.  
YOLO!

Nervous? - feed it a readonly key.  
As the tool, presently, only reads data it is the prefered way anyway.

I am presently working on a Mac, so the other OSs are untested. Please test and feedback!

## Features

Executes the paragraph you're on. Cmd-enter to Execute.  

Has text output as regular json.  
Has foldable hierarchical output with shortcuts for copying data.  
Has templateable ouput for quick text manipulation.  

Can compare records. (2 to 4 documents)

Remembers old queries.

Has quick id lookup. No more writing `"select * from c where c.id = whatever"`

Is keyboard navigatable.

Use Cmd-P for quick access to the containers.

Starts faster than Microsoft's web cosmos query tool.

## Security

The secrets are stored in respective operating system's safe haven.

## Mac

I have not  payed the 100USD/year licens for being an Apple developer so the code is unsigned. That means MacOS will complain with a dialogue "...broken file...". That can be remedied by  
`sudo xattr -rd com.apple.quarantine /Applications/Kosumoso.app`

## License

License LGPLv3 + NoEvil.  
https://raw.githubusercontent.com/LosManos/Ushi-Suki-KoSumoso/main/license.md