// Starting set of groups for the member allocation list (SRS 6.2). Picked from
// groups with 2 or more covered songs, plus ones the crew expects to cover
// again. Members are in official line order. Stage names only: no crew data.
export type SeedGroup = { slug: string; name: string; members: string[] };

export const seedGroups: SeedGroup[] = [
  {
    slug: "seventeen",
    name: "SEVENTEEN",
    members: ["S.COUPS", "Jeonghan", "Joshua", "Jun", "Hoshi", "Wonwoo", "Woozi", "THE 8", "Mingyu", "DK", "Seungkwan", "Vernon", "Dino"],
  },
  { slug: "ateez", name: "ATEEZ", members: ["Hongjoong", "Seonghwa", "Yunho", "Yeosang", "San", "Mingi", "Wooyoung", "Jongho"] },
  { slug: "tws", name: "TWS", members: ["Shinyu", "Dohoon", "Youngjae", "Hanjin", "Jihoon", "Kyungmin"] },
  { slug: "bts", name: "BTS", members: ["RM", "Jin", "SUGA", "j-hope", "Jimin", "V", "Jung Kook"] },
  { slug: "le-sserafim", name: "LE SSERAFIM", members: ["Kim Chaewon", "Sakura", "Huh Yunjin", "Kazuha", "Hong Eunchae"] },
  { slug: "ive", name: "IVE", members: ["An Yujin", "Gaeul", "Rei", "Jang Wonyoung", "Liz", "Leeseo"] },
  { slug: "and-team", name: "&TEAM", members: ["EJ", "K", "Fuma", "Nicholas", "Yuma", "Jo", "Harua", "Taki", "Maki"] },
  {
    slug: "izna",
    name: "izna",
    members: ["Mai", "Bang Jeemin", "Koko", "Yoon Jiyoon", "Choi Jungeun", "Jeong Saebi", "Ryu Sarang"],
  },
  {
    slug: "zerobaseone",
    name: "ZEROBASEONE",
    members: ["Sung Hanbin", "Kim Jiwoong", "Zhang Hao", "Seok Matthew", "Kim Taerae", "Ricky", "Kim Gyuvin", "Park Gunwook", "Han Yujin"],
  },
  { slug: "kiss-of-life", name: "KISS OF LIFE", members: ["Natty", "Julie", "Belle", "Haneul"] },
  { slug: "tomorrow-x-together", name: "TOMORROW X TOGETHER", members: ["Yeonjun", "Soobin", "Beomgyu", "Taehyun", "Huening Kai"] },
  { slug: "red-velvet", name: "Red Velvet", members: ["Irene", "Seulgi", "Wendy", "Joy", "Yeri"] },
  { slug: "cortis", name: "CORTIS", members: ["Martin", "James", "Juhoon", "Seonghyeon", "Keonho"] },
  { slug: "hearts2hearts", name: "Hearts2Hearts", members: ["Jiwoo", "Carmen", "Yuha", "Stella", "Juun", "A-na", "Ian", "Ye-on"] },
  { slug: "itzy", name: "ITZY", members: ["Yeji", "Lia", "Ryujin", "Chaeryeong", "Yuna"] },
  { slug: "blackpink", name: "BLACKPINK", members: ["Jisoo", "Jennie", "Rosé", "Lisa"] },
  { slug: "aespa", name: "aespa", members: ["Karina", "Giselle", "Winter", "Ningning"] },
  { slug: "illit", name: "ILLIT", members: ["Yunah", "Minju", "Moka", "Wonhee", "Iroha"] },
  { slug: "katseye", name: "KATSEYE", members: ["Sophia", "Lara", "Daniela", "Megan", "Manon", "Yoonchae"] },
  { slug: "girlset", name: "GIRLSET", members: ["Lexie", "Savannah", "Camila", "Kendall"] },
  { slug: "xlov", name: "XLOV", members: ["Wumuti", "Rui", "Hyun", "Haru"] },
  { slug: "enhypen", name: "ENHYPEN", members: ["Jungwon", "Jay", "Jake", "Sunghoon", "Sunoo", "Ni-ki"] },
];
