import os

files_to_modify = [
    # src/routes/pages.ts
    ("/home/asus/exelearning-code/src/routes/pages.ts", [
        ("exelearning_content: trans('eXeLearning content (.elpx)'", "exelearning_content: trans('TeacherAgent-ex content (.elpx)'"),
        ("about_exelearning: trans('About eXeLearning'", "about_exelearning: trans('About TeacherAgent-ex'"),
        ("exelearning_website: trans('eXeLearning website'", "exelearning_website: trans('TeacherAgent-ex website'"),
        ("<title>eXeLearning Workarea</title>", "<title>TeacherAgent-ex Workarea</title>"),
        ("<div id=\"root\">eXeLearning workarea - Template error: ${errorMessage}</div>", "<div id=\"root\">TeacherAgent-ex workarea - Template error: ${errorMessage}</div>"),
        ("<title>eXeLearning Admin</title>", "<title>TeacherAgent-ex Admin</title>"),
        ("<div id=\"root\">eXeLearning Admin - Template error: ${errorMessage}</div>", "<div id=\"root\">TeacherAgent-ex Admin - Template error: ${errorMessage}</div>")
    ]),
    
    # src/shared/export/adapters/YjsDocumentAdapter.ts
    ("/home/asus/exelearning-code/src/shared/export/adapters/YjsDocumentAdapter.ts", [
        ("title: (meta.get('title') as string) || 'eXeLearning'", "title: (meta.get('title') as string) || 'TeacherAgent-ex'")
    ]),
    
    # src/cli/index.ts
    ("/home/asus/exelearning-code/src/cli/index.ts", [
        ("eXeLearning CLI", "TeacherAgent-ex CLI")
    ]),
    
    # src/cli/commands/elp-convert.ts
    ("/home/asus/exelearning-code/src/cli/commands/elp-convert.ts", [
        ("Convert eXeLearning v2.x", "Convert TeacherAgent-ex v2.x"),
        ("Convert eXeLearning v2.x (.elp) file to v3.0 (.elpx) format", "Convert TeacherAgent-ex v2.x (.elp) file to v3.0 (.elpx) format")
    ])
]

for file_path, edits in files_to_modify:
    if os.path.exists(file_path):
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                content = f.read()
            
            new_content = content
            modified = False
            for target, replacement in edits:
                if target in new_content:
                    new_content = new_content.replace(target, replacement)
                    modified = True
            
            if modified:
                with open(file_path, 'w', encoding='utf-8') as f:
                    f.write(new_content)
                print(f"Successfully rebranded code file: {file_path}")
            else:
                print(f"No changes needed for code file: {file_path}")
        except Exception as e:
            print(f"Error updating code file {file_path}: {e}")
else:
    print(f"File not found: {file_path}")
