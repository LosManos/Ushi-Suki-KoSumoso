# Ushi-Suki-KoSumoso

This project is a a query tool for Azure CosmosDb.

It's purpose is to quickly retrieve data, for a developer, for developing, when developing with Cosmos.

## Works on my machine

Some stuff might not work.  
Other stuff might be stupendous.

The application is navigatable by keyboard.

It is an alpha. Your data == your loss.  
With that said - I use the *application on production data daily*.  
YOLO!

The tool does not update any cosmos documents without you going into edit mode.
Nervous? - feed it a readonly key.  

I am presently working on a Mac, so the other OSs are untested. Please test and feedback!

## Features

See the [manual](manual.md) for detailed instructions.

Executes the paragraph you're on. `Shift+Enter` to Execute (also `Cmd/Ctrl+Enter`).  

Has text output as regular json text.

Has foldable hierarchical output with shortcuts for copying data, *following foreign keys*, translate *enums to text*. Can also *fold and expand similar nodes* at once.

Has *templateable ouput* for quick text manipulation.  

Can *compare records*. (2 to 5 documents)

Remembers old queries.  
Has quick id lookup. No more writing `"select * from c where c.id = whatever"`.  
Can write simple = queries for you.  
Just press alt-enter (context menu) for hints.

Is keyboard navigatable.

Use `Cmd/Ctrl+P` for quick access to the containers.

Starts faster than Microsoft's web cosmos query tool.

## Security

The secrets are stored in respective operating system's safe haven.

## Mac

I have not  payed the 100USD/year licens for being an Apple developer so the code is unsigned. That means MacOS will complain with a dialogue "...broken file...". That can be remedied by  
`sudo xattr -rd com.apple.quarantine /Applications/Kosumoso.app`

## License

License LGPLv3 + NoEvil.  
https://raw.githubusercontent.com/LosManos/Ushi-Suki-KoSumoso/main/license.md