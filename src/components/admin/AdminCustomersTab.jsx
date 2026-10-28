import React from "react";

export default function AdminCustomersTab({
  customers,
  messages,
  subscribers,
}) {
  return (
    <div className="space-y-6">
      {/* Registered Customers */}
      <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-xs">
        <h3 className="text-sm font-bold uppercase tracking-wider text-gray-900 mb-4">
          Registered Customers ({customers.length})
        </h3>
        {customers.length === 0 ? (
          <p className="text-xs text-gray-500">No customers registered yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-gray-200 font-bold uppercase text-gray-500">
                  <th className="py-2.5 pr-4">Name</th>
                  <th className="py-2.5 pr-4">Email</th>
                  <th className="py-2.5 pr-4">Role</th>
                  <th className="py-2.5">UID</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {customers.map((c) => (
                  <tr key={c.uid}>
                    <td className="py-2.5 pr-4 font-semibold text-gray-900">
                      {c.username || c.name || "Customer"}
                    </td>
                    <td className="py-2.5 pr-4 text-gray-600">{c.email}</td>
                    <td className="py-2.5 pr-4">
                      <span className="px-2 py-0.5 rounded bg-gray-100 text-gray-800 font-semibold uppercase text-[10px]">
                        {c.role || "CUSTOMER"}
                      </span>
                    </td>
                    <td className="py-2.5 font-mono text-gray-400">
                      {String(c.uid).slice(0, 12)}...
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Contact Messages & Newsletter Subscribers */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-xs">
          <h3 className="text-sm font-bold uppercase tracking-wider text-gray-900 mb-4">
            Contact Form Inquiries ({messages.length})
          </h3>
          {messages.length === 0 ? (
            <p className="text-xs text-gray-500">No contact inquiries yet.</p>
          ) : (
            <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className="border border-gray-200 rounded-lg p-3 text-xs"
                >
                  <div className="flex justify-between font-semibold text-gray-900">
                    <span>{msg.name}</span>
                    <span className="text-gray-400">{msg.email}</span>
                  </div>
                  <p className="text-gray-600 mt-1">{msg.message}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-xs">
          <h3 className="text-sm font-bold uppercase tracking-wider text-gray-900 mb-4">
            Newsletter Subscribers ({subscribers.length})
          </h3>
          {subscribers.length === 0 ? (
            <p className="text-xs text-gray-500">
              No newsletter subscribers yet.
            </p>
          ) : (
            <ul className="divide-y divide-gray-100 text-xs max-h-80 overflow-y-auto">
              {subscribers.map((sub) => (
                <li
                  key={sub.id}
                  className="py-2 flex items-center justify-between"
                >
                  <span className="font-medium text-gray-900">{sub.email}</span>
                  <span className="text-gray-400">
                    {sub.subscribedAt
                      ? new Date(sub.subscribedAt).toLocaleDateString()
                      : "Active"}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
