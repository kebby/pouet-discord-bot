// definitions for the news.scene.org JSON API
// not complete.
// also, public domain.

declare namespace news {

    interface Item
    {
        id: number,
        title: string,
        contents: string,
        pubDate: string,
        url: string,
    }

    interface NewsFeed {
        lastBuildDate: string,
        items: Item[],
    }

}