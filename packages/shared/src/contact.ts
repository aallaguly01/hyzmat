export interface ContactAuthor {
  id: string;
  username: string | null;
  firstName: string;
}

export interface Contact {
  url: string;
  label: string;
  kind: 'username' | 'id';
}

export function buildContactLink(author: ContactAuthor): Contact {
  if (author.username) {
    return {
      url: `https://t.me/${author.username}`,
      label: `@${author.username}`,
      kind: 'username',
    };
  }
  return { url: `tg://user?id=${author.id}`, label: author.firstName, kind: 'id' };
}
