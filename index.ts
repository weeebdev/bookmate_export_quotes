import { BookmateClient } from 'bookmatejs'
import { type Params, type Quote } from 'bookmatejs/dist/types'
import fs from 'fs'
import ora from 'ora'
import { blockquote, tsMarkdown, type BlockquoteEntry } from 'ts-markdown'
import dotenv from 'dotenv'

dotenv.config()

// IMPORT DATA

const cookie = process.env.cookie as string
const client = new BookmateClient(cookie)

let data: Quote[] = []

let params: Params = {
  per_page: 50, // max 50 is supported by API,
  page: 1
}

let hasNextPage = true

const spinner = ora("Start fetching quotes").start()
while (hasNextPage) {
  spinner.text = "Fetching quotes page " + params.page
  const quotes = await client.getQuotes(params)
  data = data.concat(quotes)
  hasNextPage = quotes.length === params.per_page
  params.page!++
}

spinner.succeed(`Fetched ${data.length} quotes`)

// // save data to file
// fs.writeFileSync('quotes.json', JSON.stringify(data, null, 2))


// SAVE DATA

// read data from file
// let data: Quote[] = JSON.parse(fs.readFileSync('quotes.json', 'utf8'))

// group quotes by book
interface GroupedData {
  [key: string]: Quote[]
}

const groupedData = data.reduce((acc: GroupedData, quote) => {
  if (!acc[quote.book.uuid]) {
    acc[quote.book.uuid] = []
  }
  acc[quote.book.uuid].push(quote)
  return acc
}, {})

// get all books from quotes without duplicates
const books = data.map(quote => quote.book).filter((book, index, self) => self.findIndex(b => b.uuid === book.uuid) === index)

// create folder for quotes if not exists
if (!fs.existsSync('quotes')) {
  fs.mkdirSync('quotes')
}

const formatDate = (date: number) => {
  const d = new Date(date * 1000)
  // use yyyy-MM-dd HH:mm:ss format
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()} ${d.getHours()}:${d.getMinutes()}:${d.getSeconds()}`
}

const colorMap = [
  "yellow",
  "red",
  "blue",
  "green",
  "purple"
]

const toMarkwdown = (quotes: Quote[], entries: any[]): string => {
  quotes.forEach(quote => {
    let entry: BlockquoteEntry = {
      blockquote: [
        `[!omnivore-${colorMap[quote.color]}]+ [${quote.uuid}] ${formatDate(quote.created_at)}`,
        "",
        quote.content,
      ]
    }

    let feedback: BlockquoteEntry = {
      "blockquote": [
        `[!info]+ Feedback`,
      ]
    }

    // TODO: handle added notes afterwards
    if (quote.comment) {
      let comment: BlockquoteEntry = {
        blockquote: [
          `[!abstract]+ Notes`,
          quote.comment,
          feedback
        ]
      };
      (entry.blockquote as any[]).push(comment);
    } else {
      (entry.blockquote as any[]).push(feedback);
    }

    entries.push(entry)
  })

  return tsMarkdown(entries)
}

// create a markdown file for each quote
books.forEach(book => {
  // TODO: handle duplicates
  const filename = `quotes/${book.title}.md`

  // TODO: parse existing file
  // if (fs.existsSync(filename)) {
  //   const file = fs.readFileSync(filename, 'utf8')
  //   const { data, body }
  // }

  const quotes = groupedData[book.uuid]
  let entries: any = [
    {
      "frontmatter": {
        "id": book.uuid,
        "publish": false,
        "state": book.library_card?.state,
        "aliases": [book.title],
        // "started_at": formatDate(book.library_card?.started_at),
        // "finished_at": formatDate(book.library_card?.finished_at),
        // "accesed_at": formatDate(book.library_card?.accessed_at),
        "authors": book.authors_objects.map(author => author.name),
      }
    },
    { "h2": "Highlights" },
  ]

  let content = toMarkwdown(quotes, entries)

  fs.writeFileSync(filename, content)
})

