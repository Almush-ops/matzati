import { supabase } from './supabase';

export async function fetchAll(table: string, select: string, orderBy?: string) {
  const all: any[] = [];
  const pageSize = 1000;
  let page = 0;
  while (true) {
    let q = supabase.from(table).select(select).range(page * pageSize, (page + 1) * pageSize - 1);
    if (orderBy) q = q.order(orderBy);
    const { data } = await q;
    if (!data || data.length === 0) break;
    all.push(...data);
    if (data.length < pageSize) break;
    page++;
  }
  return all;
}
