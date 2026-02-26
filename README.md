> A template of my obsidian vault, with a focus on personal development, relationships accountability and project management

This is a desktop-only vault for the moment

# Plugins installed
From most to least important:
- Dataview (crucial, do not touch)
- Templater (necessary for hooks)
- Periodic Notes (somewhat optional) it helps with the creation of the reviews  folder
- Daily Note Navbar (optional): it helps you navigate through your journal
- Iconize (just for aesthetic value)
# Sections and folders
## Dashboard File

> [!warning] setting up configuration
> In order to configure your vault, change the options given in the brakets `{}`
> The options available are `cash: number, account: number, savings: number, savings_goal: number, track_gym: true|false`. All of them except `track_gym` are mandatory

Example
``` js
dv.view("scripts/dashboard", {cash: 50, account: 400, savings: 1000, savings_goal: 5000})
```

The dashboard file displays a birdseye view of the current situation on a weekly or monthly basis. It has the following sections:
-  projects: will show the projects from your `proojects` folder, current completion and state
- Calendar: A calendar incorporated with a habit tracker, you can add and delete as many habits as you please, but would discourage to follow more than three at a time so the monthly view doesn't cram too much
- Health: A graph indicating the sleep hours, quality, water intake and more (in the future)
- Finances: A section where you can manage your finances. Includes a Graph bar with the balance of your accounts and a pie chart with the expenses by type
## journal
For everyday use, it has diferent sections:
- habits: for habits you want to work on
- gastos: tracks the movements on your finances: income revenues, expenses, movement accross accounts
- planes: you can place here the upcoming events such as appointments, exams, dates, hangouts, events, etc. It is not a schedule. There is no order apart from the order of occurrence you have in your notes
- Tareas: section to insert the 3 most important tasks of the day. It is planned to program a rollout for the tasks undone in this section
It also tracks the following:
- bedtime and waketime: approximately anotate this data to get your sleep hours
- sleepQuality: you can also track (from 1 to 5) how recovering was your sleep schedule. Take in consideration insomnia, feeling recovered, waking up in the middle of the night, irregular sleep schedule, mine is based on the following:
	- 5: Felt recovered, slept around 8hrs on my usual sleep schedule
	- 4: slept around my sleep schedule 7-8 hours but didn't feel recovered
	- 3: had the correct bedtime but had insomnia or woke up on the middle of the night, resulting in less than 7 hours
	- 2: changed my sleep schedule and had insomnia
	- 1: I never ranked something this low, can be sleeping less than 4 hours
- water intake: how much water you drank today
- emotion: your main emotion at the end of the day, how the most impactful event left you feeling
## personas
A simpple tool for managing your relationships, you can add the birthday of a person and it will appear on the calendar. You can also add undefined plans and some information about them so you can easily recall memories and find gift ideas or future plans
## projects
A template based on David Allen's Getting Things Done template
## resources
- these are notes that will serve as part of your project, can be clippings from the web, notes on the books you've read, songs you've listend to, troubleshooting guides, cookbooks, etc
## reviews

> If you don't need or want this part, you can delete **periodic notes plugin** and set the daily note from the native plugin

This folder exists for the introspection and advancement of your goals, with different scopes:
- General Purpose: it serves as the root of your system, your guidance based on what do you want to achieve in the long run. Define your values, goals, interests, bucketlist, etc.
- Year review: since a lifetime feels immense, the year scope is the perfect span of time to get closer to your goals based on your current situation. It is recommended to set **5 goals** at maximum
- Quarterly review: a place where you can break down goals, change their dificulty or prioritize them based on what you think you have ahead
- Monthly review: a checkpoint for the goals you proposed prioritize on the quarterly review, also it is a perfect time to incorporate habits or leave some untracked if you feel it is ingrained on your everyday life
- Weekly review: designed to help you ground and prevent drifting away, it centers on planing the week ahead and check how you acted this week
# Contribuiting
PRs will not be accepted, as this is my personal vault. You're free to fork my template to develop a feature you really want
You can see my advancements on the backlog in `projects/Obsidian Dashboard.md`. This is not a serious project, the backlog is not as articulated or pulished as a profesional backlog would look like