import { useMutation, UseMutationOptions, useQueryClient } from '@tanstack/react-query'
import { toast } from 'react-hot-toast'

import { Query, SupaTable } from 'components/grid'
import { executeSql } from 'data/sql/execute-sql-query'
import { sqlKeys } from 'data/sql/keys'
import { ImpersonationRole, wrapWithRoleImpersonation } from 'lib/role-impersonation'
import { isRoleImpersonationEnabled } from 'state/role-impersonation-state'
import { ResponseError } from 'types'

export type TableRowTruncateVariables = {
  projectRef: string
  connectionString?: string
  table: SupaTable
  impersonatedRole?: ImpersonationRole
}

export function getTableRowTruncateSql({ table }: Pick<TableRowTruncateVariables, 'table'>) {
  let queryChains = new Query().from(table.name, table.schema ?? undefined).truncate()

  return queryChains.toSql()
}

export async function truncateTableRow({
  projectRef,
  connectionString,
  table,
  impersonatedRole,
}: TableRowTruncateVariables) {
  const sql = wrapWithRoleImpersonation(getTableRowTruncateSql({ table }), {
    projectRef,
    role: impersonatedRole,
  })

  const { result } = await executeSql({
    projectRef,
    connectionString,
    sql,
    isRoleImpersonationEnabled: isRoleImpersonationEnabled(impersonatedRole),
  })

  return result
}

type TableRowTruncateData = Awaited<ReturnType<typeof truncateTableRow>>

export const useTableRowTruncateMutation = ({
  onSuccess,
  onError,
  ...options
}: Omit<
  UseMutationOptions<TableRowTruncateData, ResponseError, TableRowTruncateVariables>,
  'mutationFn'
> = {}) => {
  const queryClient = useQueryClient()

  return useMutation<TableRowTruncateData, ResponseError, TableRowTruncateVariables>(
    (vars) => truncateTableRow(vars),
    {
      async onSuccess(data, variables, context) {
        const { projectRef, table } = variables
        await queryClient.invalidateQueries(sqlKeys.query(projectRef, [table.schema, table.name]))
        await onSuccess?.(data, variables, context)
      },
      async onError(data, variables, context) {
        if (onError === undefined) {
          toast.error(`Failed to truncate table row: ${data.message}`)
        } else {
          onError(data, variables, context)
        }
      },
      ...options,
    }
  )
}
