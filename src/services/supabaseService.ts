import supabase from '../../config/supabase.js';

interface QueryOptions {
  select?: string;
  eqCol?: string;
  eqRow?: any;
  containsCol?: string;
  containsRow?: any;
  orFilters?: string[];
  order1?: string;
  order1State?: boolean;
  order2?: string;
  order2State?: boolean;
  limit?: number;
}

export const selectTable = async (
  table: string,
  options: QueryOptions = {}
): Promise<any[]> => {
  let query = supabase.from(table).select(options.select || '*');

  if (options.eqCol !== undefined) {
    query = query.eq(options.eqCol, options.eqRow);
  }
  if (options.containsCol !== undefined) {
    query = query.contains(options.containsCol, options.containsRow);
  }
  if (options.orFilters?.length) {
    for (const f of options.orFilters) {
      query = query.or(f);
    }
  }

  if (options.order1) {
    query = query.order(options.order1, { ascending: options.order1State ?? true });
  }
  if (options.order2) {
    query = query.order(options.order2, { ascending: options.order2State ?? true });
  }
  if (options.limit) {
    query = query.limit(options.limit);
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return data || [];
};

export const insertTable = async (table: string, data: object): Promise<void> => {
  const { error } = await supabase.from(table).insert(data);
  if (error) throw new Error(`${error.message}`);
};

export const updateTable = async (
  table: string,
  data: object,
  eqCol: string,
  eqRow: any
): Promise<void> => {
  const { error } = await supabase.from(table).update(data).eq(eqCol, eqRow);
  if (error) throw new Error(`${error.message}`);
};

export const deleteTable = async (
  table: string,
  eqCol: string,
  eqRow: any
): Promise<void> => {
  const { error } = await supabase.from(table).delete().eq(eqCol, eqRow);
  if (error) throw new Error(`${error.message}`);
};